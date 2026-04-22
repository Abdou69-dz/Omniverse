import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { ArrowLeft, Users, Send, Settings, Trophy, Crown } from 'lucide-react';
import { cn } from '../lib/utils';
import { UnoGame } from './games/UnoGame';
import { UnoCard, UnoColor, UnoValue } from '../types/uno';
import { motion } from 'motion/react';

interface GameRoomProps {
  roomId: string;
  onExit: () => void;
}

const createUnoDeck = (): UnoCard[] => {
  const deck: UnoCard[] = [];
  const colors: Exclude<UnoColor, 'wild'>[] = ['red', 'blue', 'green', 'yellow'];
  const values: UnoValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

  colors.forEach(color => {
    values.forEach(value => {
      // One '0', two of everything else per color
      const count = value === '0' ? 1 : 2;
      for (let i = 0; i < count; i++) {
        deck.push({ id: `${color}-${value}-${i}`, color, value, score: isNaN(Number(value)) ? 20 : Number(value) });
      }
    });
  });

  // Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-wild-${i}`, color: 'wild', value: 'wild', score: 50 });
    deck.push({ id: `wild-draw4-${i}`, color: 'wild', value: 'draw4', score: 50 });
  }

  return deck.sort(() => Math.random() - 0.5);
};

export function GameRoom({ roomId, onExit }: GameRoomProps) {
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Join room locally (ensure document exists in players subcollection)
    const joinRoom = async () => {
      const playerRef = doc(db, `rooms/${roomId}/players`, user.uid);
      await setDoc(playerRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        joinedAt: serverTimestamp()
      }, { merge: true });
    };

    joinRoom();

    const roomUnsubscribe = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        setRoom({ id: doc.id, ...doc.data() });
      } else {
        onExit();
      }
    });

    const playersUnsubscribe = onSnapshot(collection(db, `rooms/${roomId}/players`), (snapshot) => {
      const playerList = snapshot.docs
        .sort((a, b) => (a.data().joinedAt?.seconds || 0) - (b.data().joinedAt?.seconds || 0))
        .map(d => ({ id: d.id, ...d.data() }));
      setPlayers(playerList);
    });

    const gameUnsubscribe = onSnapshot(doc(db, 'games', roomId), (doc) => {
      if (doc.exists()) {
        setGameState({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    });

    return () => {
      roomUnsubscribe();
      playersUnsubscribe();
      gameUnsubscribe();
    };
  }, [roomId, user]);

  const startGame = async () => {
    if (!room || room.hostId !== user?.uid || players.length < 2) return;
    
    let initialData = {};
    if (room.gameType === 'uno') {
      const deck = createUnoDeck();
      const hands: { [uid: string]: UnoCard[] } = {};
      const playerOrder = players.map(p => p.id);

      // Deal 7 cards to each player
      playerOrder.forEach(uid => {
        hands[uid] = deck.splice(0, 7);
      });

      // First card (must not be wild for simplicity)
      let firstCardIndex = deck.findIndex(c => c.color !== 'wild');
      const discardPile = [deck.splice(firstCardIndex, 1)[0]];

      initialData = {
        deck,
        discardPile,
        hands,
        turnIndex: 0,
        direction: 1,
        status: 'playing',
        winnerId: null,
        playerOrder,
        activeColor: discardPile[0].color,
        unoPressed: {}
      };
    }

    await setDoc(doc(db, 'games', roomId), {
      roomId,
      ...initialData,
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'playing'
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Arena...</p>
    </div>
  );

  return (
    <div className="flex flex-col xl:flex-row gap-10 animate-in fade-in duration-700">
      {/* Game Area */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button 
                onClick={onExit}
                className="p-2 bg-white/5 rounded-lg text-white/30 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-black uppercase tracking-[0.2em] rounded-md">
                Match ID: {roomId.slice(0, 8)}
              </div>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white">{room?.name}</h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Game Engine</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="font-bold text-sm uppercase text-white/80">{room?.gameType} Arena</span>
              </div>
            </div>
            <div className="h-10 w-[1px] bg-white/10" />
            <button className="p-3 glass-panel rounded-xl hover:border-accent/40 transition-colors">
              <Settings className="w-5 h-5 text-white/30" />
            </button>
          </div>
        </div>

        <div className="aspect-video bg-card-bg rounded-[40px] border border-white/10 relative overflow-hidden flex items-center justify-center shadow-2xl accent-glow/20">
          <div className="absolute inset-0 bg-radial from-accent/5 to-transparent pointer-events-none" />
          
          {room?.status === 'waiting' && (
            <div className="text-center p-12 space-y-12 relative z-10 w-full max-w-2xl">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-accent/20 blur-[50px] rounded-full animate-pulse" />
                <div className="flex justify-center -space-x-8 relative">
                  {players.map((p, i) => (
                    <motion.div 
                      key={p.id}
                      initial={{ scale: 0, x: 50 }}
                      animate={{ scale: 1, x: 0 }}
                      transition={{ delay: i * 0.1, type: 'spring' }}
                      className="relative group"
                    >
                      <img 
                        src={p.photoURL} 
                        className="w-24 h-24 rounded-full border-4 border-card-bg bg-white/5 shadow-2xl transition-transform group-hover:scale-110 group-hover:z-50 ring-2 ring-accent/30" 
                        alt="" 
                      />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-accent px-3 py-1 rounded-md text-[9px] font-black uppercase shadow-xl whitespace-nowrap">
                        {p.displayName}
                      </div>
                    </motion.div>
                  ))}
                  {Array.from({ length: Math.max(0, room?.maxPlayers - players.length) }).map((_, i) => (
                    <div 
                      key={`empty-${i}`} 
                      className="w-24 h-24 rounded-full border-4 border-dashed border-white/5 bg-white/2 flex items-center justify-center opacity-40"
                    >
                      <Users className="w-8 h-8 text-white/10" />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-5xl font-black uppercase tracking-tighter text-white">Lobby Initialized</h3>
                  <p className="text-accent text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
                    Waiting for {room?.maxPlayers - players.length} signatures to launch
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 bg-white/2">
                   <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                     Transmit this frequency to your allies:<br/>
                     <span className="text-white text-lg font-black tracking-[0.2em]">{room?.roomCode || roomId.slice(0, 8).toUpperCase()}</span>
                   </p>
                   <button 
                     onClick={() => navigator.clipboard.writeText(room?.roomCode || roomId.slice(0, 8).toUpperCase())}
                     className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border border-white/10"
                   >
                     Copy Frequency
                   </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                {room?.hostId === user?.uid ? (
                  <button
                    onClick={startGame}
                    className="px-16 py-6 bg-accent text-white font-black uppercase tracking-[0.3em] text-xs rounded-[2rem] hover:brightness-110 transition-all active:scale-95 shadow-[0_0_50px_rgba(124,58,237,0.4)] accent-glow"
                  >
                    Engage Mission Start
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-2">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    </div>
                    <div className="inline-block px-10 py-4 glass-panel rounded-2xl text-white/30 text-[10px] uppercase font-black tracking-[0.2em]">
                      Standby for Commander Authorization
                    </div>
                  </div>
                )}
              </div>

              <footer className="pt-10 border-t border-white/5 opacity-20">
                <p className="text-[8px] font-black uppercase tracking-widest mb-1">Ahmed Debbech Production © 2026</p>
                <p className="text-[8px] font-bold uppercase tracking-widest">Designed with love by Ons Kechrid</p>
              </footer>
            </div>
          )}

          {room?.status === 'playing' && gameState && (
            <div className="w-full h-full relative z-10">
              {room.gameType === 'uno' && <UnoGame state={gameState} roomId={roomId} />}
              {room.gameType === 'domino' && <div className="p-20 text-center uppercase font-black text-white/5 text-5xl">Domino Arena</div>}
              {room.gameType === 'ludo' && <div className="p-20 text-center uppercase font-black text-white/5 text-5xl">Ludo Kingdom</div>}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Info */}
      <div className="w-full xl:w-96 space-y-8">
        <div className="glass-panel rounded-[32px] p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="font-black uppercase text-[10px] tracking-[0.2em] text-white/40">Battle Group</h3>
            </div>
            <span className="text-[10px] font-black text-accent">{players.length} Active</span>
          </div>
          
          <div className="space-y-5">
            {players.map(p => (
              <div key={p.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={p.photoURL} className="w-11 h-11 rounded-full border border-white/10" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-card-bg" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-white/90">{p.displayName}</p>
                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                      {p.id === room?.hostId ? <><Crown className="w-2.5 h-2.5 text-accent" /> Commanding</> : 'Warrior'}
                    </p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="text-[9px] font-black uppercase text-accent/60 hover:text-accent">Profile</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-8 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Send className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-black uppercase text-[10px] tracking-[0.2em] text-white/40">Comms Link</h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-5 flex flex-col-reverse custom-scrollbar mb-6">
            <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
               <p className="text-[10px] font-bold text-white/20 mb-2 uppercase tracking-widest">System Protocol</p>
               <p className="text-xs text-white/50 leading-relaxed">Secure communication link established. Good luck, commander.</p>
            </div>
          </div>
          
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Transmit message..."
              className="w-full bg-white/3 border border-white/10 rounded-2xl px-6 py-4 text-xs focus:outline-none focus:border-accent transition-all text-white placeholder:text-white/20"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-accent/40 group-focus-within:text-accent transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
