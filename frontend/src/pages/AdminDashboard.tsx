import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Shield, LogOut, Search, FileText, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
type AdminUser = {
  id: number;
  name: string;
  masked_email: string;
  role: string;
  status: string;
  created_at?: string;
  last_active?: string;
  files_count: number;
  failed_files: number;
  latest_profile_version: number;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'all'|'active'|'locked'|'deleted'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin');
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (status !== 'all') params.set('status', status);
        params.set('page', String(page));
        params.set('limit', String(limit));
        params.set('sort', 'last_active:desc');
        const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include', signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load users');
        const json = await res.json();
        const d = json?.data;
        setUsers(d?.users || []);
        setTotal(d?.total || 0);
      } catch (e) {
        if ((e as any).name !== 'AbortError') console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    return () => controller.abort();
  }, [searchQuery, status, page, limit]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">Admin Dashboard</span>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-primary/30 hover:border-primary"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Visible Page Files</p>
                <p className="text-2xl font-bold">{users.reduce((acc, u) => acc + u.files_count, 0)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Docs/Page User</p>
                <p className="text-2xl font-bold">{users.length ? (users.reduce((acc, u) => acc + u.files_count, 0) / users.length).toFixed(1) : '0.0'}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search students by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border rounded-md px-3 py-2 bg-background"
              value={status}
              onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="deleted">Deleted</option>
            </select>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page<=1 || loading} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" disabled={page*limit>=total || loading} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        </motion.div>

        {/* Users Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {users.filter(u => u.role !== 'admin').map((u, index) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-6 bg-card border-border hover:border-primary/50 transition-all">
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{u.name}</h3>
                  <p className="text-sm text-muted-foreground">{u.masked_email}</p>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                    {u.files_count} Files
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm ${u.status==='active'?'bg-emerald-100 text-emerald-700':u.status==='locked'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>
                    {u.status}
                  </div>
                </div>

                <Button
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  View Profile
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {users.length === 0 && !loading && (
          <Card className="p-12 text-center bg-card border-border border-dashed">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search query
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
