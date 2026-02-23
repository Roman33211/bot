import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Bot,
  AlertCircle,
  Shield,
  Trash2,
  Plus,
  X,
  LayoutDashboard,
  Settings,
  Search,
  Filter,
  BarChart3,
  FileText,
  ChevronDown,
  Download,
  UserPlus,
  Save
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface Lead {
  id: number;
  name: string;
  role: string;
  sku_count: string;
  preferred_time: string;
  notes: string;
  source: string;
  assigned_to: string;
  created_at: string;
  status: string;
}

interface Admin {
  telegram_id: string;
  username: string;
  created_at: string;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  slug: string;
  created_at: string;
}

interface Stats {
  total: number;
  new: number;
  byRole: { role: string; count: number }[];
  byStatus: { status: string; count: number }[];
  overTime: { date: string; count: number }[];
}

const COLORS = ['#F27D26', '#FFFFFF', '#404040', '#808080'];

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, byRole: [], byStatus: [], overTime: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'stats' | 'admins' | 'faq'>('leads');
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  
  // Admin Management
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  // Lead Details Modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  // FAQ Management
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', slug: '' });

  const fetchData = async () => {
    try {
      const [leadsRes, statsRes, adminsRes, faqRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/stats'),
        fetch('/api/admins'),
        fetch('/api/faq')
      ]);
      
      if (leadsRes.ok && statsRes.ok && adminsRes.ok && faqRes.ok) {
        setLeads(await leadsRes.json());
        setStats(await statsRes.json());
        setAdmins(await adminsRes.json());
        setFaqs(await faqRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           lead.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesRole = roleFilter === 'all' || lead.role === roleFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesRole && matchesSource;
    });
  }, [leads, searchQuery, statusFilter, roleFilter, sourceFilter]);

  const updateLeadStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
        setSelectedLead(prev => prev && prev.id === id ? { ...prev, status } : prev);
        fetchData(); // Refresh stats
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const saveNotes = async (id: number) => {
    try {
      const res = await fetch(`/api/leads/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNotes })
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: editingNotes } : l));
        setSelectedLead(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const assignLead = async (leadId: number, adminId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId })
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: adminId } : l));
        setSelectedLead(prev => prev && prev.id === leadId ? { ...prev, assigned_to: adminId } : prev);
        fetchData();
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
    }
  };

  const addAdmin = async () => {
    if (!newAdminId || !newAdminName) return;
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: newAdminId, username: newAdminName })
      });
      if (res.ok) {
        setNewAdminId('');
        setNewAdminName('');
        setShowAddAdmin(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error adding admin:', error);
    }
  };

  const deleteAdmin = async (id: string) => {
    if (!confirm('Удалить этого администратора?')) return;
    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Error deleting admin:', error);
    }
  };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFaq || newFaq)
      });
      if (res.ok) {
        fetchData();
        setShowAddFaq(false);
        setEditingFaq(null);
        setNewFaq({ question: '', answer: '', slug: '' });
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
    }
  };

  const deleteFaq = async (id: number) => {
    if (!confirm('Удалить этот вопрос?')) return;
    try {
      const res = await fetch(`/api/faq/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const exportLeads = () => {
    const headers = ['ID', 'Имя', 'Роль', 'SKU', 'Время', 'Статус', 'Источник', 'Ответственный', 'Дата', 'Заметки'];
    const rows = filteredLeads.map(l => [
      l.id, l.name, l.role, l.sku_count, l.preferred_time, l.status, l.source || 'N/A', l.assigned_to || 'N/A', l.created_at, l.notes || ''
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `visualica_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-visualica-dark font-sans text-white pb-20">
      {/* Header */}
      <header className="bg-visualica-dark border-b border-visualica-border sticky top-0 z-20 px-4 py-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-visualica-orange flex items-center justify-center">
              <span className="text-black font-black text-xl italic">V</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">VISUALICA</h1>
              <div className="text-[10px] font-bold text-visualica-orange uppercase tracking-[0.2em]">
                Панель управления
              </div>
            </div>
          </div>
          
          <nav className="hidden md:flex bg-black p-1">
            {[
              { id: 'leads', label: 'Заявки', icon: MessageSquare },
              { id: 'stats', label: 'Аналитика', icon: BarChart3 },
              { id: 'admins', label: 'Команда', icon: Shield },
              { id: 'faq', label: 'FAQ', icon: Bot }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-visualica-orange text-black' : 'text-white/50 hover:text-white'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportLeads}
              className="p-2 bg-black border border-visualica-border text-white/50 hover:text-visualica-orange transition-colors"
              title="Экспорт в CSV"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-visualica-border z-30 flex justify-around py-4">
        {[
          { id: 'leads', icon: MessageSquare },
          { id: 'stats', icon: BarChart3 },
          { id: 'admins', icon: Shield },
          { id: 'faq', icon: Bot }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`p-2 rounded-xl transition-all ${activeTab === tab.id ? 'text-visualica-orange scale-110' : 'text-white/30'}`}
          >
            <tab.icon className="w-6 h-6" />
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'leads' && (
            <motion.div 
              key="leads"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Filters & Search Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-visualica-card p-4 border border-visualica-border">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input 
                    type="text"
                    placeholder="Поиск по имени или роли..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-visualica-border pl-12 pr-4 py-3 text-sm font-bold italic focus:border-visualica-orange outline-none"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-[calc(50%-4px)] md:w-40 bg-black border border-visualica-border px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-visualica-orange appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
                  >
                    <option value="all">Все статусы</option>
                    <option value="new">Новые</option>
                    <option value="contacted">В работе</option>
                    <option value="done">Завершено</option>
                  </select>
                  
                  <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-[calc(50%-4px)] md:w-40 bg-black border border-visualica-border px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-visualica-orange appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
                  >
                    <option value="all">Все роли</option>
                    {Array.from(new Set(leads.map(l => l.role))).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>

                  <select 
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full md:w-40 bg-black border border-visualica-border px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-visualica-orange appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
                  >
                    <option value="all">Все источники</option>
                    {Array.from(new Set(leads.map(l => l.source).filter(Boolean))).map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Leads List */}
              <div className="grid grid-cols-1 gap-4">
                {filteredLeads.length === 0 ? (
                  <div className="bg-visualica-card p-20 text-center border border-visualica-border">
                    <MessageSquare className="w-16 h-16 text-white/5 mx-auto mb-4" />
                    <p className="text-white/20 font-black uppercase tracking-[0.3em]">Заявок не найдено</p>
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <motion.div 
                      layout
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setEditingNotes(lead.notes || '');
                      }}
                      className="bg-visualica-card border border-visualica-border hover:border-visualica-orange cursor-pointer group transition-all"
                    >
                      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-black text-2xl uppercase italic tracking-tight group-hover:text-visualica-orange transition-colors">
                              {lead.name}
                            </h3>
                            <span className={`text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter italic ${
                              lead.status === 'new' ? 'bg-visualica-orange text-black' : 
                              lead.status === 'contacted' ? 'bg-white text-black' : 
                              'bg-black text-white/30'
                            }`}>
                              {lead.status === 'new' ? 'НОВАЯ' : lead.status === 'contacted' ? 'В РАБОТЕ' : 'ГОТОВО'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {lead.role}</span>
                            <span className="flex items-center gap-1.5"><LayoutDashboard className="w-3 h-3" /> {lead.sku_count} SKU</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {lead.preferred_time}</span>
                            <span className="flex items-center gap-1.5 text-visualica-orange"><Bot className="w-3 h-3" /> {lead.source || 'Бот'}</span>
                            {lead.assigned_to && (
                              <span className="flex items-center gap-1.5 text-white/60"><Shield className="w-3 h-3" /> {admins.find(a => a.telegram_id === lead.assigned_to)?.username || 'Оператор'}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Дата создания</div>
                            <div className="text-xs font-bold italic">{new Date(lead.created_at).toLocaleDateString('ru-RU')}</div>
                          </div>
                          <ChevronDown className="w-5 h-5 text-white/20 group-hover:text-visualica-orange -rotate-90" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Leads Over Time */}
                <div className="bg-visualica-card border border-visualica-border p-8 md:col-span-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 visualica-accent-line">Динамика заявок (30 дней)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.overTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '12px' }}
                          itemStyle={{ color: '#F27D26' }}
                        />
                        <Bar dataKey="count" fill="#F27D26" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Role Distribution */}
                <div className="bg-visualica-card border border-visualica-border p-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 visualica-accent-line">Распределение по ролям</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byRole}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="role" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '12px' }}
                          itemStyle={{ color: '#F27D26' }}
                        />
                        <Bar dataKey="count" fill="#F27D26" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-visualica-card border border-visualica-border p-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 visualica-accent-line">Статусы обработки</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.byStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="status"
                        >
                          {stats.byStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    {stats.byStatus.map((s, i) => (
                      <div key={s.status} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Всего лидов', value: stats.total, icon: Users },
                  { label: 'Новых заявок', value: stats.new, icon: AlertCircle },
                  { label: 'Конверсия', value: `${stats.total > 0 ? Math.round((stats.new / stats.total) * 100) : 0}%`, icon: BarChart3 },
                  { label: 'Команда', value: admins.length, icon: Shield }
                ].map((item, i) => (
                  <div key={i} className="bg-visualica-card p-6 border border-visualica-border">
                    <item.icon className="w-4 h-4 text-visualica-orange mb-4" />
                    <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">{item.label}</div>
                    <div className="text-3xl font-black italic">{item.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'admins' && (
            <motion.div 
              key="admins"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] visualica-accent-line">
                  Авторизованные операторы
                </h2>
                <button 
                  onClick={() => setShowAddAdmin(true)}
                  className="bg-visualica-orange text-black px-6 py-3 text-xs font-black uppercase italic hover:bg-white transition-all flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Добавить
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {admins.map((admin) => (
                  <div key={admin.telegram_id} className="bg-visualica-card border border-visualica-border p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black flex items-center justify-center">
                        <Shield className="text-visualica-orange w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-black uppercase italic text-lg">{admin.username}</div>
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">TG ID: {admin.telegram_id}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteAdmin(admin.telegram_id)}
                      className="p-3 text-white/10 hover:text-visualica-orange hover:bg-black transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'faq' && (
            <motion.div 
              key="faq"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] visualica-accent-line">
                  База знаний (FAQ)
                </h2>
                <button 
                  onClick={() => {
                    setEditingFaq(null);
                    setNewFaq({ question: '', answer: '', slug: '' });
                    setShowAddFaq(true);
                  }}
                  className="bg-visualica-orange text-black px-6 py-3 text-xs font-black uppercase italic hover:bg-white transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Добавить вопрос
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {faqs.map((faq) => (
                  <div key={faq.id} className="bg-visualica-card border border-visualica-border p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] font-bold text-visualica-orange uppercase tracking-widest mb-1">{faq.slug}</div>
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">{faq.question}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingFaq(faq);
                            setShowAddFaq(true);
                          }}
                          className="p-3 text-white/10 hover:text-white hover:bg-black transition-all"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteFaq(faq.id)}
                          className="p-3 text-white/10 hover:text-visualica-orange hover:bg-black transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-white/60 whitespace-pre-wrap leading-relaxed bg-black/40 p-4 border-l-2 border-visualica-orange">
                      {faq.answer}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Lead Details Modal */}
      <AnimatePresence>
        {selectedLead && (
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedLead(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-visualica-card w-full max-w-2xl border border-visualica-orange shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-[10px] font-bold text-visualica-orange uppercase tracking-[0.3em]">Карточка клиента</div>
                      <span className={`text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter italic ${
                        selectedLead.status === 'new' ? 'bg-visualica-orange text-black' : 
                        selectedLead.status === 'contacted' ? 'bg-white text-black' : 
                        'bg-black text-white/30'
                      }`}>
                        {selectedLead.status === 'new' ? 'НОВАЯ' : selectedLead.status === 'contacted' ? 'В РАБОТЕ' : 'ГОТОВО'}
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold uppercase italic tracking-tighter">{selectedLead.name}</h2>
                    <p className="text-xs font-medium text-white/40 mt-2 uppercase tracking-widest">{selectedLead.role}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedLead(null)}
                    className="p-3 bg-black border border-visualica-border text-white/50 hover:text-visualica-orange transition-colors flex items-center gap-2 group"
                  >
                    <X className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase tracking-widest hidden sm:inline">Закрыть</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-medium text-white/20 uppercase tracking-widest mb-2">Статус обработки</label>
                      <div className="flex gap-2">
                        {['new', 'contacted', 'done'].map(s => (
                          <button 
                            key={s}
                            onClick={() => updateLeadStatus(selectedLead.id, s)}
                            className={`flex-1 py-3 text-[10px] font-semibold uppercase italic tracking-tighter transition-all ${
                              selectedLead.status === s ? 'bg-visualica-orange text-black' : 'bg-black text-white/30 hover:text-white'
                            }`}
                          >
                            {s === 'new' ? 'НОВЫЙ' : s === 'contacted' ? 'В РАБОТЕ' : 'ГОТОВО'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-black/40 p-6 space-y-4 border border-visualica-border/30">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Объем каталога</span>
                        <span className="text-sm font-medium italic">{selectedLead.sku_count} SKU</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Удобное время</span>
                        <span className="text-sm font-medium italic">{selectedLead.preferred_time}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Источник</span>
                        <span className="text-sm font-medium italic text-visualica-orange">{selectedLead.source || 'Telegram Bot'}</span>
                      </div>
                      
                      <div className="pt-2 border-t border-visualica-border/20">
                        <label className="block text-[9px] font-medium text-white/20 uppercase tracking-widest mb-2">Ответственный оператор</label>
                        <div className="relative">
                          <select 
                            value={selectedLead.assigned_to || ''}
                            onChange={(e) => assignLead(selectedLead.id, e.target.value)}
                            className="w-full bg-black border border-visualica-border px-4 py-3 text-xs font-medium italic outline-none focus:border-visualica-orange appearance-none cursor-pointer pr-10"
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
                          >
                            <option value="">Не назначен</option>
                            {admins.map(admin => (
                              <option key={admin.telegram_id} value={admin.telegram_id}>{admin.username}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-visualica-border/20">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Дата заявки</span>
                        <span className="text-sm font-medium italic">{new Date(selectedLead.created_at).toLocaleString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col h-full">
                    <label className="block text-[9px] font-medium text-white/20 uppercase tracking-widest mb-2">Внутренние заметки</label>
                    <textarea 
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Добавьте детали разговора, требования или комментарии..."
                      className="flex-1 bg-black border border-visualica-border p-4 text-sm font-medium italic focus:border-visualica-orange outline-none resize-none min-h-[200px]"
                    />
                    <button 
                      onClick={() => saveNotes(selectedLead.id)}
                      className="mt-4 bg-visualica-orange text-black font-black uppercase italic py-5 hover:bg-white transition-all shadow-xl shadow-visualica-orange/10 active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      <Save className="w-5 h-5" />
                      Сохранить изменения
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddAdmin && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-visualica-card w-full max-w-md border border-visualica-orange p-10"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">Новый оператор</h3>
                <button onClick={() => setShowAddAdmin(false)} className="p-2 bg-black text-white/50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Telegram ID</label>
                  <input 
                    type="text" 
                    value={newAdminId}
                    onChange={(e) => setNewAdminId(e.target.value)}
                    placeholder="000000000"
                    className="w-full bg-black border border-visualica-border px-4 py-4 text-sm font-bold italic focus:border-visualica-orange outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Имя оператора</label>
                  <input 
                    type="text" 
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="ИМЯ ФАМИЛИЯ"
                    className="w-full bg-black border border-visualica-border px-4 py-4 text-sm font-bold italic focus:border-visualica-orange outline-none"
                  />
                </div>
                <button 
                  onClick={addAdmin}
                  className="w-full bg-visualica-orange text-black font-black uppercase italic py-5 hover:bg-white transition-all shadow-2xl shadow-visualica-orange/20"
                >
                  Подтвердить доступ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add FAQ Modal */}
      <AnimatePresence>
        {showAddFaq && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-visualica-card w-full max-w-lg border border-visualica-orange shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                    {editingFaq ? 'Редактировать вопрос' : 'Новый вопрос'}
                  </h2>
                  <button onClick={() => setShowAddFaq(false)} className="text-white/40 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={saveFaq} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Slug (уникальный ID)</label>
                    <input 
                      type="text"
                      value={editingFaq ? editingFaq.slug : newFaq.slug}
                      onChange={(e) => editingFaq ? setEditingFaq({...editingFaq, slug: e.target.value}) : setNewFaq({...newFaq, slug: e.target.value})}
                      placeholder="faq_example"
                      className="w-full bg-black border border-visualica-border px-4 py-3 text-sm font-medium outline-none focus:border-visualica-orange"
                      required
                      disabled={!!editingFaq}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Вопрос (текст кнопки)</label>
                    <input 
                      type="text"
                      value={editingFaq ? editingFaq.question : newFaq.question}
                      onChange={(e) => editingFaq ? setEditingFaq({...editingFaq, question: e.target.value}) : setNewFaq({...newFaq, question: e.target.value})}
                      placeholder="Как работает...?"
                      className="w-full bg-black border border-visualica-border px-4 py-3 text-sm font-medium outline-none focus:border-visualica-orange"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Ответ (поддерживает HTML)</label>
                    <textarea 
                      value={editingFaq ? editingFaq.answer : newFaq.answer}
                      onChange={(e) => editingFaq ? setEditingFaq({...editingFaq, answer: e.target.value}) : setNewFaq({...newFaq, answer: e.target.value})}
                      placeholder="Используйте <b>текст</b> для жирного шрифта..."
                      className="w-full bg-black border border-visualica-border px-4 py-3 text-sm font-medium outline-none focus:border-visualica-orange h-40 resize-none"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-white text-black font-black uppercase italic py-4 hover:bg-visualica-orange transition-all"
                  >
                    {editingFaq ? 'Сохранить изменения' : 'Создать вопрос'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
