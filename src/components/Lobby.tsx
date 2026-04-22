import { useState, useEffect, FormEvent } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Plus, Users, Play, Crown, Search } from 'lucide-react';
import { cn } from '../lib/utils';

interface Room {
  id: string;
  name: string;
  gameType: 'uno' | 'domino' | 'ludo';
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
}

export function Lobby({ onJoinRoom }: { onJoinRoom: (id: string) => void }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', gameType: 'uno' as const, maxPlayers: 4 });

  useEffect(() => {
    const q = query(collection(db, 'rooms'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomList.filter(r => r.status === 'waiting'));
    });
    return unsubscribe;
  }, []);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        ...newRoom,
        hostId: user.uid,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      
      // Join the room as a player
      await setDoc(doc(db, `rooms/${roomRef.id}/players`, user.uid), {
        displayName: user.displayName,
        photoURL: user.photoURL,
        joinedAt: serverTimestamp()
      });

      onJoinRoom(roomRef.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tight mb-1">Discover Games</h2>
          <p className="text-white/40 font-medium text-sm">Multiplayer classics, reimagined for the digital age.</p>
        </div>
        <div className="flex gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/3 border border-white/10 rounded-xl text-xs font-bold text-white/40">
            Filter: Popular
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white font-bold rounded-xl hover:brightness-110 transition-all active:scale-95 accent-glow uppercase text-xs tracking-widest"
          >
            <Plus className="w-4 h-4" />
            Quick Create
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-card-bg border border-white/10 p-10 rounded-[32px] w-full max-w-lg animate-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[80px] -z-10 rounded-full" />
            <h3 className="text-3xl font-black uppercase mb-8 tracking-tighter">Setup Game Arena</h3>
            <form onSubmit={handleCreateRoom} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Room Identity</label>
                <input
                  type="text"
                  required
                  value={newRoom.name}
                  onChange={e => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/3 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-accent transition-colors text-white placeholder:text-white/10"
                  placeholder="Elite Warriors Only"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Select Engine</label>
                <div className="grid grid-cols-3 gap-4">
                  {(['uno', 'domino', 'ludo'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewRoom(prev => ({ ...prev, gameType: type }))}
                      className={cn(
                        "py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-[0.15em] transition-all",
                        newRoom.gameType === type 
                          ? "bg-accent border-accent text-white accent-glow" 
                          : "bg-white/3 border-white/5 text-white/40 hover:border-white/20"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Max Seats</label>
                <div className="flex items-center gap-4">
                   <input
                    type="range"
                    min="2"
                    max="8"
                    step="1"
                    value={newRoom.maxPlayers}
                    onChange={e => setNewRoom(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                    className="flex-1 accent-accent"
                  />
                  <span className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl font-black text-accent border border-accent/20">{newRoom.maxPlayers}</span>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-4 px-6 bg-white/5 text-white/50 font-bold rounded-2xl hover:bg-white/10 transition-all uppercase text-xs tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 px-6 bg-accent text-white font-bold rounded-2xl hover:brightness-110 transition-all uppercase text-xs tracking-widest accent-glow"
                >
                  Launch Arena
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8 pb-20">
        {rooms.length === 0 ? (
          <div className="col-span-full py-32 text-center glass-panel rounded-[40px]">
            <Search className="w-16 h-16 text-white/10 mx-auto mb-6" />
            <p className="text-white/40 font-black text-2xl uppercase tracking-tighter">No Active Arenas</p>
            <p className="text-white/20 text-xs font-bold uppercase tracking-widest mt-2">Initialize a match to begin</p>
          </div>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id}
              className="group bg-card-bg border border-white/10 rounded-[32px] overflow-hidden hover:border-accent transition-all cursor-pointer shadow-2xl hover:shadow-[0_0_50px_var(--color-accent-glow)] flex flex-col h-full"
              onClick={() => onJoinRoom(room.id)}
            >
              <div className={cn(
                "h-48 relative flex items-center justify-center overflow-hidden",
                room.gameType === 'uno' && "bg-radial from-red-500 to-red-900",
                room.gameType === 'domino' && "bg-radial from-slate-700 to-slate-950",
                room.gameType === 'ludo' && "bg-radial from-amber-400 to-amber-700"
              )}>
                {room.gameType === 'uno' && <div className="text-5xl font-black text-white italic -rotate-12 shadow-2xl">UNO</div>}
                {room.gameType === 'domino' && (
                  <div className="flex gap-2">
                    <div className="w-10 h-16 bg-white rounded-sm text-black flex items-center justify-center">::</div>
                    <div className="w-10 h-16 bg-white rounded-sm text-black flex items-center justify-center">::</div>
                  </div>
                )}
                {room.gameType === 'ludo' && (
                   <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-xl grid grid-cols-2 grid-rows-2 p-1.5 gap-1 rotate-45 border border-white/30">
                    <div className="bg-red-500/80 rounded-sm" /><div className="bg-blue-500/80 rounded-sm" /><div className="bg-green-500/80 rounded-sm" /><div className="bg-yellow-500/80 rounded-sm" />
                   </div>
                )}
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md text-[9px] font-black text-white/50 tracking-widest uppercase">
                  Active
                </div>
              </div>
              
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-2xl font-black group-hover:text-accent transition-colors uppercase tracking-tighter">{room.name}</h4>
                  {room.maxPlayers > 4 && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Mega</span>}
                </div>
                <p className="text-white/30 text-[11px] font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> {room.maxPlayers} Player Table • Open Arena
                </p>

                <button className="mt-auto w-full py-4 bg-accent text-white font-black rounded-2xl group-hover:accent-glow transition-all uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3">
                  <Play className="w-4 h-4 fill-current" /> Play Now
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
