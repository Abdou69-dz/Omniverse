import { useAuth } from './components/AuthContext';
import { signInWithGoogle, auth } from './lib/firebase';
import { LogOut, Trophy, Users, Swords, Gamepad2, Crown } from 'lucide-react';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { useState } from 'react';
import { cn } from './lib/utils';

export default function App() {
  const { user } = useAuth();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-deep text-text-ui flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent/10 blur-[120px] rounded-full -z-10" />
        <div className="max-w-md w-full space-y-8 text-center glass-panel p-12 rounded-[32px] shadow-2xl backdrop-blur-2xl">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center accent-glow rotate-3">
              <Gamepad2 className="w-8 h-8 text-white -rotate-3" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase mb-2">Omniverse</h1>
            <p className="text-white/50 font-medium tracking-wide text-sm uppercase">Gaming Universe Pro</p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 px-6 bg-accent text-white font-bold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-3 active:scale-95 accent-glow"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 brightness-0 invert" alt="Google" />
            Sign in with Omnicore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-deep text-text-ui font-sans selection:bg-accent selection:text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl h-20 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-accent w-8 h-8 rounded-lg accent-glow flex items-center justify-center">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase text-white">Omniverse</span>
          </div>
          
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
              <a href="#" className="hover:text-accent transition-colors flex items-center gap-2 active:text-accent"><Trophy className="w-4 h-4" /> Marketplace</a>
              <a href="#" className="hover:text-accent transition-colors flex items-center gap-2"><Users className="w-4 h-4" /> Community</a>
              <a href="#" className="hover:text-accent transition-colors flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> Live Streams</a>
            </nav>
            
            <div className="h-6 w-[1px] bg-white/10" />
            
            <div className="flex items-center gap-4">
              <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 text-[11px] font-bold flex items-center gap-2">
                <span className="opacity-50">💎 1,240</span>
                <span className="w-[1px] h-3 bg-white/10" />
                <span className="text-accent">🪙 45K</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-accent" alt="" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                </div>
                <button 
                  onClick={() => auth.signOut()}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="flex gap-10">
          <aside className="hidden xl:block w-64 space-y-8">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6">Online Friends</h3>
              <div className="space-y-4">
                {[
                  { name: 'HyperBeast', game: 'Playing Dominoes', online: true },
                  { name: 'Luna_X', game: 'In Lobby', online: true },
                  { name: 'GhostRider', game: 'Offline', online: false },
                ].map((friend) => (
                  <div key={friend.name} className={cn("flex items-center gap-4", !friend.online && "opacity-40")}>
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20" />
                      {friend.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white/90">{friend.name}</p>
                      <p className="text-[10px] font-medium text-white/30">{friend.game}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {!currentRoomId ? (
              <Lobby onJoinRoom={setCurrentRoomId} />
            ) : (
              <GameRoom roomId={currentRoomId} onExit={() => setCurrentRoomId(null)} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
