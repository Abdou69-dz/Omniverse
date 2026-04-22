import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { RefreshCcw, Hand, Layers, AlertCircle, Trophy } from 'lucide-react';
import { UnoCard, UnoColor } from '../../types/uno';

interface UnoGameProps {
  state: any;
  roomId: string;
}

export function UnoGame({ state, roomId }: UnoGameProps) {
  const { user } = useAuth();
  const game = state; // State is now the full game document
  const playerOrder = game.playerOrder || [];
  const currentPlayerId = playerOrder[game.turnIndex];
  const isMyTurn = user?.uid === currentPlayerId;
  const myHand = game.hands[user?.uid || ''] || [];
  const topCard = game.discardPile[game.discardPile.length - 1];
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [pickingColorFor, setPickingColorFor] = useState<UnoCard | null>(null);

  const nextTurn = (stateUpdate: any, skipCount = 1) => {
    let nextIndex = (game.turnIndex + (game.direction * skipCount)) % playerOrder.length;
    if (nextIndex < 0) nextIndex = playerOrder.length + nextIndex;
    stateUpdate.turnIndex = nextIndex;
  };

  const drawCard = async () => {
    if (!isMyTurn || isDrawing || !!game.winnerId) return;
    setIsDrawing(true);

    const deck = [...game.deck];
    const hands = { ...game.hands };
    const myUid = user!.uid;

    if (deck.length === 0) {
      // Reshuffle discard pile into deck if empty
      const newDeck = game.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
      deck.push(...newDeck);
    }

    const drawn = deck.pop();
    if (drawn) {
      hands[myUid] = [...(hands[myUid] || []), drawn];
      
      const update: any = {
        deck,
        hands,
        updatedAt: serverTimestamp()
      };
      
      // If card can't be played, automatically move to next turn (simplified)
      // For now, just allow drawing one and then user must manually pass or play
      // In this basic version, we just let them draw.
      
      await updateDoc(doc(db, 'games', roomId), update);
    }
    
    setIsDrawing(false);
  };

  const playCard = async (card: UnoCard, chosenColor?: UnoColor) => {
    if (!isMyTurn || !!game.winnerId) return;

    // Validation
    const canPlay = card.color === 'wild' || 
                    card.color === game.activeColor || 
                    card.value === topCard.value;

    if (!canPlay) return;

    if (card.color === 'wild' && !chosenColor) {
      setPickingColorFor(card);
      return;
    }

    const hands = { ...game.hands };
    const discardPile = [...game.discardPile];
    const myUid = user!.uid;
    
    hands[myUid] = hands[myUid].filter(c => c.id !== card.id);
    discardPile.push(card);

    const update: any = {
      hands,
      discardPile,
      activeColor: chosenColor || card.color,
      updatedAt: serverTimestamp()
    };

    // Special effects
    let skipCount = 1;
    if (card.value === 'reverse') {
      update.direction = game.direction * -1;
      if (playerOrder.length === 2) skipCount = 2; // In 2 player, reverse acts like skip
    } else if (card.value === 'skip') {
      skipCount = 2;
    } else if (card.value === 'draw2') {
      // Next player draws 2 and is skipped
      const nextPlayerId = playerOrder[(game.turnIndex + game.direction + playerOrder.length) % playerOrder.length];
      const deck = [...game.deck];
      const penaltyCards = deck.splice(-2);
      hands[nextPlayerId] = [...(hands[nextPlayerId] || []), ...penaltyCards];
      update.deck = deck;
      skipCount = 2;
    } else if (card.value === 'draw4') {
       const nextPlayerId = playerOrder[(game.turnIndex + game.direction + playerOrder.length) % playerOrder.length];
       const deck = [...game.deck];
       const penaltyCards = deck.splice(-4);
       hands[nextPlayerId] = [...(hands[nextPlayerId] || []), ...penaltyCards];
       update.deck = deck;
       skipCount = 2;
    }

    // Win condition
    if (hands[myUid].length === 0) {
      update.winnerId = myUid;
      update.status = 'finished';
      await updateDoc(doc(db, 'rooms', roomId), { status: 'finished' });
    } else {
      nextTurn(update, skipCount);
    }

    await updateDoc(doc(db, 'games', roomId), update);
    setPickingColorFor(null);
  };

  const passTurn = async () => {
    if (!isMyTurn || !!game.winnerId) return;
    const update: any = { updatedAt: serverTimestamp() };
    nextTurn(update);
    await updateDoc(doc(db, 'games', roomId), update);
  };

  const toggleUno = async () => {
    const unoPressed = { ...game.unoPressed };
    unoPressed[user!.uid] = !unoPressed[user!.uid];
    await updateDoc(doc(db, 'games', roomId), { unoPressed });
  };

  return (
    <div className="w-full h-full flex flex-col relative p-8">
      {/* Game Over Overlay */}
      <AnimatePresence>
        {game.winnerId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
          >
            <Trophy className="w-20 h-20 text-yellow-500 mb-6 accent-glow" />
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-2">Victory!</h2>
            <p className="text-white/40 font-bold uppercase tracking-widest mb-10">
              {game.winnerId === user?.uid ? "You are the champion" : "Better luck next time"}
            </p>
            <div className="flex items-center gap-4">
               <img src={user?.photoURL || ''} className="w-16 h-16 rounded-full border-4 border-accent shadow-2xl" alt="" />
               <div className="text-left">
                  <p className="font-black text-xl">{user?.displayName}</p>
                  <p className="text-accent text-xs font-bold uppercase tracking-widest">Match Winner</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Center */}
      <div className="flex-1 flex items-center justify-center gap-16 relative">
        {/* Deck */}
        <div 
          onClick={drawCard}
          className={cn(
            "w-28 h-40 bg-gradient-to-br from-accent to-accent/60 rounded-2xl border-4 border-white/20 flex items-center justify-center cursor-pointer shadow-2xl transition-all active:scale-95 overflow-hidden active:accent-glow relative group",
            isDrawing && "animate-pulse scale-105",
            !isMyTurn && "opacity-50 grayscale cursor-not-allowed"
          )}
        >
          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
          <div className="w-20 h-32 border-2 border-white/10 rounded-xl flex items-center justify-center font-black text-3xl text-white italic tracking-tighter mix-blend-overlay">
            UNO
          </div>
        </div>

        {/* Discard Pile */}
        <div className="w-28 h-40 glass-panel rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative flex items-center justify-center border-4 border-white/20 overflow-hidden scale-110">
           <div className={cn(
             "w-full h-full rounded-xl flex items-center justify-center text-5xl p-2 font-black text-white italic shadow-inner transition-colors duration-500",
             game.activeColor === 'red' && "bg-red-600",
             game.activeColor === 'blue' && "bg-blue-600",
             game.activeColor === 'green' && "bg-green-600",
             game.activeColor === 'yellow' && "bg-yellow-500",
             game.activeColor === 'wild' && "bg-slate-800"
           )}>
              {topCard?.value === 'skip' ? '⊘' : 
               topCard?.value === 'reverse' ? '⇄' :
               topCard?.value === 'draw2' ? '+2' :
               topCard?.value === 'draw4' ? '+4' :
               topCard?.value === 'wild' ? 'W' : topCard?.value}
           </div>
        </div>

        {/* Turn Direction HUD */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-4 border-dashed border-accent/10 rounded-full pointer-events-none transition-transform duration-1000" style={{ transform: `translate(-50%, -50%) rotate(${game.direction === 1 ? 0 : 180}deg)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 bg-accent px-5 py-1.5 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] text-white accent-glow">
            {game.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}
          </div>
          <RefreshCcw className={cn("absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-12 h-12 text-accent/20", game.direction === 1 ? "animate-[spin_15s_linear_infinite]" : "animate-[spin_15s_linear_infinite_reverse]")} />
        </div>
      </div>

      {/* Action Indicators */}
      <div className="flex justify-center mb-6">
        <div className={cn(
          "px-8 py-3 rounded-2xl flex items-center gap-4 transition-all duration-500",
          isMyTurn ? "bg-accent accent-glow scale-110" : "bg-white/5 border border-white/10"
        )}>
          {isMyTurn ? (
            <>
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              <span className="font-black uppercase text-xs tracking-[0.2em]">Your Strategic Phase</span>
            </>
          ) : (
            <span className="font-bold uppercase text-[10px] tracking-[0.2em] text-white/30 italic">Waiting for Opponent...</span>
          )}
        </div>
      </div>

      {/* Player Hand */}
      <div className="h-64 flex items-center justify-center px-20">
        <div className="flex -space-x-12 hover:-space-x-4 transition-all duration-500">
          {myHand.map((card: UnoCard) => (
            <motion.div
              key={card.id}
              whileHover={{ y: -80, scale: 1.25, zIndex: 100 }}
              onClick={() => playCard(card)}
              className="w-24 h-36 bg-white rounded-2xl border-4 border-white shadow-2xl cursor-pointer relative overflow-hidden group transition-shadow hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-colors pointer-events-none z-10" />
              
              <div className={cn(
                "absolute inset-1 rounded-xl flex flex-col items-center justify-between p-2 py-4 text-white font-black italic",
                card.color === 'red' && "bg-red-600",
                card.color === 'blue' && "bg-blue-600",
                card.color === 'green' && "bg-green-600",
                card.color === 'yellow' && "bg-yellow-500",
                card.color === 'wild' && "bg-[conic-gradient(#ef4444_90deg,#3b82f6_90deg_180deg,#22c55e_180deg_270deg,#eab308_270deg)]"
              )}>
                {/* Top Left Mini Value */}
                <span className="text-[10px] absolute top-1 left-1.5 opacity-80 non-italic font-bold">
                  {card.value.length < 3 ? card.value : card.value[0].toUpperCase()}
                </span>

                {/* Central Value / Icon */}
                <div className="flex-1 flex items-center justify-center">
                   <span className="text-5xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]">
                      {card.value === 'draw2' ? '+2' : 
                       card.value === 'draw4' ? '+4' : 
                       card.value === 'skip' ? '⊘' :
                       card.value === 'reverse' ? '⇄' :
                       card.value === 'wild' ? 'W' : card.value}
                   </span>
                </div>

                {/* Bottom Logo - Matching PHP logic */}
                <div className="text-[7px] font-black tracking-widest opacity-40 uppercase">
                  Royal Uno
                </div>

                {/* Bottom Right Inverted Mini Value */}
                <span className="text-[10px] absolute bottom-1 right-1.5 rotate-180 opacity-80 non-italic font-bold">
                   {card.value.length < 3 ? card.value : card.value[0].toUpperCase()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player Action HUD */}
      <div className="absolute bottom-12 right-12 flex flex-col gap-4">
        <button 
          onClick={toggleUno}
          className={cn(
            "p-6 rounded-[24px] font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center gap-4",
            game.unoPressed?.[user?.uid || ''] 
              ? "bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]" 
              : "bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:scale-105"
          )}
        >
          <Hand className="w-5 h-5" /> UNO!
        </button>
        <button 
          onClick={passTurn}
          disabled={!isMyTurn}
          className="p-6 glass-panel text-white/50 border border-white/10 rounded-[24px] font-black uppercase text-[10px] tracking-[0.3em] hover:bg-white/10 transition-all flex items-center gap-4 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <RefreshCcw className="w-5 h-5" /> Pass Strategic
        </button>
      </div>

      {/* Color Picker Modal */}
      <AnimatePresence>
        {pickingColorFor && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8"
          >
            <div className="glass-panel p-12 rounded-[48px] max-w-xl w-full text-center space-y-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />
              <h3 className="text-4xl font-black uppercase tracking-tighter">Define Target Color</h3>
              <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Wild Protocol Initiated</p>
              
              <div className="grid grid-cols-2 gap-6">
                {(['red', 'blue', 'green', 'yellow'] as UnoColor[]).map(color => (
                  <button
                    key={color}
                    onClick={() => playCard(pickingColorFor, color)}
                    className={cn(
                      "h-32 rounded-3xl transition-transform hover:scale-105 active:scale-95 shadow-2x border-4 border-white/10",
                      color === 'red' && "bg-red-600",
                      color === 'blue' && "bg-blue-600",
                      color === 'green' && "bg-green-600",
                      color === 'yellow' && "bg-yellow-500"
                    )}
                  />
                ))}
              </div>
              <button 
                onClick={() => setPickingColorFor(null)}
                className="text-white/20 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition-colors"
              >
                Abort Protocol
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
