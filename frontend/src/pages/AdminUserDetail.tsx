import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [overview, setOverview] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const parseProfile = (data: any) => {
    const pj = data?.profile_json;
    if (!pj) return null;
    if (typeof pj === 'string') {
      try { return JSON.parse(pj); } catch { return pj; }
    }
    return pj;
  };
  const [files, setFiles] = useState<any[]> ([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const safeParse = async (res: Response) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 120)}`);
      }
      return res.json();
    };

    const loadAll = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [ov, pr, fl, ac] = await Promise.all([
          fetch(`/api/admin/users/${id}/overview`, { credentials: 'include' }),
          fetch(`/api/admin/users/${id}/profile`, { credentials: 'include' }),
          fetch(`/api/admin/users/${id}/files`, { credentials: 'include' }),
          fetch(`/api/admin/users/${id}/activity`, { credentials: 'include' }),
        ]);

        if (!ov.ok) throw new Error(`Overview failed: ${ov.status}`);
        if (!pr.ok) throw new Error(`Profile failed: ${pr.status}`);
        if (!fl.ok) throw new Error(`Files failed: ${fl.status}`);
        if (!ac.ok) throw new Error(`Activity failed: ${ac.status}`);

        const ovj = await safeParse(ov);
        const prj = await safeParse(pr);
        const flj = await safeParse(fl);
        const acj = await safeParse(ac);
        setOverview(ovj?.data || null);
        setProfile(prj?.data || null);
        setFiles(flj?.data?.files || []);
        setEvents(acj?.data?.events || []);
      } catch (e:any) {
        toast({ title: 'Failed to load user', description: e?.message || 'Please try again', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [id]);

  const act = async (type: string, payload: any = {}) => {
    try {
      if (type === 'REGENERATE') setRegenLoading(true);
      const res = await fetch(`/api/admin/users/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0,120) || 'Action failed');
      }
      let json: any = null;
      try { json = await res.json(); } catch { throw new Error('Action did not return JSON'); }
      if (!json.success) throw new Error(json.message || 'Action failed');
      toast({ title: `${type} done` });
      // reload overview/profile/files as appropriate
      if (type === 'LOCK' || type === 'UNLOCK') {
        const ov = await fetch(`/api/admin/users/${id}/overview`, { credentials: 'include' });
        const ovj = await ov.json().catch(() => ({}));
        setOverview(ovj?.data || null);
      }
      if (type === 'REGENERATE') {
        const pr = await fetch(`/api/admin/users/${id}/profile`, { credentials: 'include' });
        const prj = await pr.json().catch(() => ({}));
        setProfile(prj?.data || null);
      }
      if (type === 'DELETE_FILE' || type === 'REEXTRACT') {
        const fl = await fetch(`/api/admin/users/${id}/files`, { credentials: 'include' });
        const flj = await fl.json().catch(() => ({}));
        setFiles(flj?.data?.files || []);
      }
      const ac = await fetch(`/api/admin/users/${id}/activity`, { credentials: 'include' });
      const acj = await ac.json().catch(() => ({}));
      setEvents(acj?.data?.events || []);
    } catch (e:any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' });
    } finally {
      setRegenLoading(false);
    }
  };

  if (!overview) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/dashboard')} className="border-primary/30 hover:border-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Admin view for {overview.name}</h1>
            <p className="text-sm text-muted-foreground">Status: {overview.status}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div><div className="text-sm text-muted-foreground">Email</div><div>{overview.email}</div></div>
              <div><div className="text-sm text-muted-foreground">Latest Version</div><div>{overview.latest_profile_version}</div></div>
              <div><div className="text-sm text-muted-foreground">Files</div><div>{overview.files_total}</div></div>
              <div><div className="text-sm text-muted-foreground">Failed</div><div>{overview.failed}</div></div>
            </div>
            <div className="mt-4 flex gap-2">
              {overview.status !== 'locked' ? (
                <Button variant="outline" onClick={() => act('LOCK', { reason: 'admin_request' })}>Lock</Button>
              ) : (
                <Button variant="outline" onClick={() => act('UNLOCK', { reason: 'admin_request' })}>Unlock</Button>
              )}
              <Button onClick={() => act('REGENERATE', { profile_json: parseProfile(profile) || {} })}>Regenerate Profile</Button>
            </div>
          </Card>
          <Card className="p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">AI Generated Profile</h2>
            </div>
            {(() => {
              const pj = parseProfile(profile);
              if (regenLoading) {
                return (
                  <div className="text-sm text-muted-foreground">Regenerating profile...</div>
                );
              }
              if (!pj || (typeof pj === 'object' && Object.keys(pj).length === 0)) {
                return (
                  <div className="text-sm text-muted-foreground">No profile yet. Click Regenerate Profile to build one from user documents.</div>
                );
              }
              const data: any = pj;
              return (
                <div className="space-y-4">
                  {data.name && <h3 className="text-2xl font-bold">{data.name}</h3>}
                  {data.summary && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="leading-relaxed">{data.summary}</p>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    {data.email && (
                      <div>
                        <div className="text-sm text-muted-foreground">Email</div>
                        <div>{data.email}</div>
                      </div>
                    )}
                    {data.education && (
                      <div>
                        <div className="text-sm text-muted-foreground">Education</div>
                        <div>{data.education}</div>
                      </div>
                    )}
                  </div>
                  {Array.isArray(data.skills) && data.skills.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {data.skills.map((s: string, idx: number) => (
                          <span key={idx} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(data.certifications) && data.certifications.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Certifications</div>
                      <ul className="list-disc ml-5 text-sm text-muted-foreground">
                        {data.certifications.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(data.achievements) && data.achievements.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Achievements</div>
                      <ul className="list-disc ml-5 text-sm text-muted-foreground">
                        {data.achievements.map((a: string, idx: number) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card className="p-6">
            <div className="space-y-3">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{f.filename}</div>
                    <div className="text-xs text-muted-foreground">{new Date(f.uploaded_at || Date.now()).toLocaleString()} • {f.mime_type || 'unknown'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/document/${f.id}`, '_blank')}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/document/${f.id}/download`, '_blank')}>Download</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/document/${f.id}`, { method: 'DELETE', credentials: 'include' });
                          if (!res.ok) {
                            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                          }
                          const contentType = res.headers.get('content-type') || '';
                          if (!contentType.includes('application/json')) {
                            const text = await res.text();
                            throw new Error(`Unexpected response: ${text.slice(0,120)}`);
                          }
                          const json = await res.json();
                          if (!json.success) throw new Error(json.message || 'Delete failed');
                          // Refresh files list
                          const fl = await fetch(`/api/admin/users/${id}/files`, { credentials: 'include' });
                          const ct = fl.headers.get('content-type') || '';
                          if (!fl.ok || !ct.includes('application/json')) {
                            throw new Error('Failed to refresh files');
                          }
                          const flj = await fl.json();
                          setFiles(flj?.data?.files || []);
                          toast({ title: 'File deleted' });
                          toast({
                            title: 'Consider regenerating the profile',
                            description: 'To reflect file changes, use Regenerate Profile on the Overview tab.'
                          });
                        } catch (e: any) {
                          toast({ title: 'Delete failed', description: e?.message || 'Try again', variant: 'destructive' });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="p-6">
            <div className="space-y-3">
              {events.map(ev => (
                <div key={ev.id} className="text-sm">
                  <div className="font-medium">{ev.action}</div>
                  <div className="text-xs text-muted-foreground">{ev.created_at}</div>
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(ev.details || {}, null, 2)}</pre>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminUserDetail;


