import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Users, Home as HomeIcon, Settings, Clock, Star, Shield, AlertCircle, LogIn, LogOut, Edit2, Medal, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, login, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---
interface Debater {
  id: string;
  name: string;
  team: string;
  cost: number;
  total_points?: number;
}

interface UserTeam {
  userId: string;
  teamName: string;
  captainId: string | null;
  memberIds: string[];
}

interface Score {
  debaterId: string;
  roundNumber: number;
  points: number;
}

// --- Constants ---
const ADMIN_EMAIL = "sweatycoiner@gmail.com";

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, isAdmin, user }: { activeTab: string, setActiveTab: (tab: string) => void, isAdmin: boolean, user: User | null }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-50 sm:top-0 sm:bottom-auto sm:border-b sm:border-t-0">
    {[
      { id: 'home', icon: HomeIcon, label: 'Home', show: true },
      { id: 'team', icon: Users, label: 'My Team', show: !!user },
      { id: 'standings', icon: Trophy, label: 'Debaters', show: true },
      { id: 'leaderboard', icon: Medal, label: 'League', show: !!user },
      { id: 'admin', icon: Settings, label: 'Admin', show: isAdmin },
    ].filter(i => i.show).map((item) => (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        <item.icon size={20} />
        <span className="text-[10px] uppercase font-bold tracking-wider">{item.label}</span>
      </button>
    ))}
    {user && (
      <button onClick={logout} className="flex flex-col items-center gap-1 text-gray-500 hover:text-rose-600">
        <LogOut size={20} />
        <span className="text-[10px] uppercase font-bold tracking-wider">Logout</span>
      </button>
    )}
  </nav>
);

const Home = () => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [nextRound, setNextRound] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'next_round'), (doc) => {
      if (doc.exists()) setNextRound(doc.data().value);
    });
  }, []);

  useEffect(() => {
    if (!nextRound) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(nextRound).getTime() - now;
      
      if (distance < 0) {
        setTimeLeft("Round Started!");
        clearInterval(timer);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextRound]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-indigo-50 p-12 rounded-3xl border border-indigo-100 shadow-xl max-w-md w-full"
      >
        <Clock className="text-indigo-600 mx-auto mb-6" size={48} />
        <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2">Next Round Countdown</h2>
        <div className="text-4xl font-black text-indigo-900 font-mono tracking-tighter">
          {timeLeft || 'Loading...'}
        </div>
        <p className="mt-6 text-indigo-600/60 text-xs font-medium uppercase tracking-widest">Prepare your team</p>
      </motion.div>
    </div>
  );
};

const Standings = ({ debaters, scores }: { debaters: Debater[], scores: Score[] }) => {
  const rankedDebaters = useMemo(() => {
    return debaters.map(d => {
      const total = scores.filter(s => s.debaterId === d.id).reduce((acc, s) => acc + s.points, 0);
      return { ...d, total_points: total };
    }).sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [debaters, scores]);

  const teamScores = useMemo(() => {
    return scores.reduce((acc, s) => {
      const d = debaters.find(deb => deb.id === s.debaterId);
      if (d) acc[d.team as 'A' | 'B'] += s.points;
      return acc;
    }, { A: 0, B: 0 });
  }, [debaters, scores]);

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 sm:pt-20">
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border-2 border-indigo-600 p-6 rounded-2xl text-center shadow-sm">
          <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Team A</h3>
          <div className="text-3xl font-black text-gray-900">{teamScores.A}</div>
        </div>
        <div className="bg-white border-2 border-rose-600 p-6 rounded-2xl text-center shadow-sm">
          <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">Team B</h3>
          <div className="text-3xl font-black text-gray-900">{teamScores.B}</div>
        </div>
      </div>

      <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
        <Trophy className="text-amber-500" size={24} />
        Debater Rankings
      </h2>

      <div className="space-y-3">
        {rankedDebaters.map((d, i) => (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            key={d.id}
            className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <span className="text-lg font-black text-gray-300 w-6">#{i + 1}</span>
              <div>
                <div className="font-bold text-gray-900 capitalize">{d.name}</div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${d.team === 'A' ? 'text-indigo-500' : 'text-rose-500'}`}>
                  Team {d.team}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-indigo-600">{d.total_points}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase">Points</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const MyTeam = ({ debaters, scores, user }: { debaters: Debater[], scores: Score[], user: User }) => {
  const [userTeam, setUserTeam] = useState<UserTeam>({ userId: user.uid, teamName: '', captainId: null, memberIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'userTeams', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserTeam({ 
          userId: user.uid,
          teamName: data.teamName || '',
          captainId: data.captainId, 
          memberIds: data.memberIds || [] 
        });
      }
    });
  }, [user]);

  const toggleMember = (id: string) => {
    setUserTeam(prev => {
      const isSelected = prev.memberIds.includes(id);
      if (isSelected) {
        return {
          ...prev,
          memberIds: prev.memberIds.filter(mId => mId !== id),
          captainId: prev.captainId === id ? null : prev.captainId
        };
      } else {
        if (prev.memberIds.length >= 3) return prev;
        return { ...prev, memberIds: [...prev.memberIds, id] };
      }
    });
  };

  const setCaptain = (id: string) => {
    setUserTeam(prev => ({ ...prev, captainId: id }));
  };

  const totalCost = userTeam.memberIds.reduce((acc, id) => {
    const d = debaters.find(deb => deb.id === id);
    return acc + (d?.cost || 0);
  }, 0);

  const teamSeasonPoints = useMemo(() => {
    return userTeam.memberIds.reduce((acc, id) => {
      const debaterScores = scores.filter(s => s.debaterId === id);
      const points = debaterScores.reduce((sum, s) => sum + s.points, 0);
      const multiplier = userTeam.captainId === id ? 2 : 1;
      return acc + (points * multiplier);
    }, 0);
  }, [userTeam, scores]);

  const saveTeam = async () => {
    setSaving(true);
    setError('');
    try {
      if (!userTeam.teamName.trim()) throw new Error("Team name is required");
      if (totalCost > 100) throw new Error("Cost cap exceeded (Max 100)");
      await setDoc(doc(db, 'userTeams', user.uid), {
        userId: user.uid,
        teamName: userTeam.teamName,
        captainId: userTeam.captainId,
        memberIds: userTeam.memberIds,
        updatedAt: serverTimestamp()
      });
      setIsEditingName(false);
      alert('Team saved successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 sm:pt-20">
      <div className="bg-indigo-900 text-white p-6 rounded-3xl mb-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-4">
              {isEditingName ? (
                <input
                  autoFocus
                  type="text"
                  value={userTeam.teamName}
                  onChange={(e) => setUserTeam({ ...userTeam, teamName: e.target.value })}
                  onBlur={() => setIsEditingName(false)}
                  className="bg-indigo-800 text-white border-none rounded-lg px-2 py-1 w-full font-black text-xl focus:ring-2 focus:ring-indigo-400"
                  placeholder="Enter Team Name"
                />
              ) : (
                <h2 
                  onClick={() => setIsEditingName(true)}
                  className="text-2xl font-black flex items-center gap-2 cursor-pointer hover:text-indigo-300 transition-colors"
                >
                  {userTeam.teamName || 'Unnamed Squad'}
                  <Edit2 size={16} className="opacity-50" />
                </h2>
              )}
              <div className="text-[10px] uppercase font-bold text-indigo-300 mt-1">Fantasy Squad</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-amber-400">{teamSeasonPoints}</div>
              <div className="text-[10px] uppercase font-bold text-indigo-300">Season Points</div>
            </div>
          </div>
          
          <div className="flex justify-between items-end mt-8">
            <div>
              <div className="text-4xl font-black">{userTeam.memberIds.length}/3</div>
              <div className="text-[10px] uppercase font-bold text-indigo-300">Debaters Selected</div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black ${totalCost > 100 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totalCost}/100
              </div>
              <div className="text-[10px] uppercase font-bold text-indigo-300">Cost Cap</div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-800 rounded-full -mr-16 -mt-16 opacity-50" />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 mb-8">
        {debaters.map((d) => {
          const isSelected = userTeam.memberIds.includes(d.id);
          const isCaptain = userTeam.captainId === d.id;
          return (
            <div
              key={d.id}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white'}`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleMember(d.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}
                >
                  {isSelected && <Star size={12} fill="currentColor" />}
                </button>
                <div>
                  <div className="font-bold text-gray-900 capitalize">{d.name}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Team {d.team} • Cost: {d.cost}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isSelected && (
                  <button
                    onClick={() => setCaptain(d.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isCaptain ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  >
                    {isCaptain ? 'Captain (2x)' : 'Make Captain'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={saveTeam}
        disabled={saving || userTeam.memberIds.length !== 3 || !userTeam.captainId || totalCost > 100 || !userTeam.teamName}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
      >
        {saving ? 'Saving...' : 'Save Squad'}
      </button>
    </div>
  );
};

const Leaderboard = ({ debaters, scores, user }: { debaters: Debater[], scores: Score[], user: User }) => {
  const [allTeams, setAllTeams] = useState<UserTeam[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'userTeams'), (snap) => {
      setAllTeams(snap.docs.map(doc => doc.data() as UserTeam));
    });
  }, []);

  const rankedTeams = useMemo(() => {
    return allTeams.map(team => {
      const points = team.memberIds.reduce((acc, id) => {
        const debaterScores = scores.filter(s => s.debaterId === id);
        const p = debaterScores.reduce((sum, s) => sum + s.points, 0);
        const multiplier = team.captainId === id ? 2 : 1;
        return acc + (p * multiplier);
      }, 0);
      return { ...team, totalPoints: points };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [allTeams, scores]);

  const myRank = rankedTeams.findIndex(t => t.userId === user.uid) + 1;

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 sm:pt-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <Medal className="text-indigo-600" size={28} />
          Global League
        </h2>
        {myRank > 0 && (
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-md">
            Your Rank: #{myRank}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {rankedTeams.map((team, i) => {
          const isMe = team.userId === user.uid;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={team.userId}
              className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${isMe ? 'border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-100' : 'border-gray-100 bg-white shadow-sm'}`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-300'}`}>
                  {i + 1}
                </div>
                <div>
                  <div className="font-black text-gray-900 text-lg leading-tight">
                    {team.teamName || 'Unnamed Squad'}
                    {isMe && <span className="ml-2 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">You</span>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {team.memberIds.map(mId => {
                      const d = debaters.find(deb => deb.id === mId);
                      const isCap = team.captainId === mId;
                      return (
                        <span key={mId} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isCap ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600 leading-none">{team.totalPoints}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Points</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const Admin = ({ debaters }: { debaters: Debater[] }) => {
  const [round, setRound] = useState(1);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      Object.entries(points).forEach(([debaterId, p]) => {
        const scoreRef = doc(collection(db, 'scores'));
        batch.set(scoreRef, {
          debaterId,
          roundNumber: round,
          points: p,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      alert('Points updated!');
      setPoints({});
    } catch (err) {
      console.error(err);
      alert('Error updating points');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 sm:pt-20">
      <div className="flex items-center gap-4 mb-8">
        <Shield className="text-indigo-600" size={32} />
        <div>
          <h2 className="text-2xl font-black text-gray-900">Admin Panel</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enter Round Results</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Round Number</label>
        <input
          type="number"
          value={round}
          onChange={(e) => setRound(parseInt(e.target.value))}
          className="w-full p-4 bg-gray-50 rounded-xl border-none font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="space-y-3 mb-8">
        {debaters.map((d) => (
          <div key={d.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="font-bold text-gray-900 capitalize">{d.name}</div>
            <input
              type="number"
              placeholder="0"
              value={points[d.id] || ''}
              onChange={(e) => setPoints({ ...points, [d.id]: parseInt(e.target.value) || 0 })}
              className="w-20 p-2 bg-gray-50 rounded-lg border-none text-center font-black text-indigo-600 focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {saving ? 'Saving...' : 'Submit Points'}
      </button>
    </div>
  );
};

const LoginScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-sm w-full"
    >
      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200 rotate-3">
        <Trophy className="text-white" size={40} />
      </div>
      <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Debate Fantasy</h1>
      <p className="text-gray-500 font-medium mb-10 leading-relaxed">Join the league and build your ultimate debating squad.</p>
      <button
        onClick={login}
        className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-100"
      >
        <LogIn size={20} />
        Sign in with Google
      </button>
    </motion.div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubDebaters = onSnapshot(collection(db, 'debaters'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debater));
      setDebaters(list);
      
      // Seed if empty
      if (list.length === 0 && isAdmin) {
        const seed = [
          { name: "tom", team: "A", cost: 35 },
          { name: "aron", team: "A", cost: 30 },
          { name: "amay", team: "A", cost: 25 },
          { name: "sameer", team: "A", cost: 20 },
          { name: "cameron", team: "A", cost: 15 },
          { name: "matthew", team: "B", cost: 35 },
          { name: "lincoln", team: "B", cost: 30 },
          { name: "justin", team: "B", cost: 25 },
          { name: "darren", team: "B", cost: 20 },
          { name: "james", team: "B", cost: 15 }
        ];
        seed.forEach(d => setDoc(doc(collection(db, 'debaters')), d));
      }
    });

    const unsubScores = onSnapshot(collection(db, 'scores'), (snap) => {
      setScores(snap.docs.map(doc => doc.data() as Score));
    });

    return () => {
      unsubDebaters();
      unsubScores();
    };
  }, [isAdmin]);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-indigo-600 uppercase tracking-widest">Loading...</div>;
  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} user={user} />
      
      <main className="pb-20 sm:pb-0 sm:pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'home' && <Home />}
            {activeTab === 'team' && <MyTeam debaters={debaters} scores={scores} user={user} />}
            {activeTab === 'standings' && <Standings debaters={debaters} scores={scores} />}
            {activeTab === 'leaderboard' && <Leaderboard debaters={debaters} scores={scores} user={user} />}
            {activeTab === 'admin' && isAdmin && <Admin debaters={debaters} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

