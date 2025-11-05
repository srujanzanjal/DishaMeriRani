import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, LogOut, Upload, FileText, Download, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// Removed mock data; fetch from backend only
import { useToast } from '@/hooks/use-toast';
import FileUpload from '@/components/FileUpload';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [aiProfile, setAiProfile] = useState<any>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState<{active: boolean; current: number; total: number}>({ active: false, current: 0, total: 0 });
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'Come back soon!',
    });
    navigate('/');
  };

  const handleFileUpload = async (files: File[]) => {
    if (!files?.length) return;

    let successCount = 0;
    let errorCount = 0;

    try {
      // Create a single axios instance with default config
      const axios = (await import('axios')).default;
      
      // First, verify the session is still valid
      try {
        await axios.get('/api/verify', { withCredentials: true });
      } catch (authError) {
        console.error('Session verification failed:', authError);
        toast({
          title: 'Session Expired',
          description: 'Please log in again to continue',
          variant: 'destructive',
        });
        // Optionally redirect to login
        // navigate('/login');
        return;
      }

      // Upload each file one by one using the same axios instance
      setUploadingOverlay({ active: true, current: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadingOverlay({ active: true, current: i + 1, total: files.length });
        try {
          const formData = new FormData();
          formData.append('document', file);

          const response = await axios.post('/api/upload', formData, {
            withCredentials: true, // Include cookies for session
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            // Add timeout and other axios config as needed
            timeout: 30000, // 30 seconds timeout
            onUploadProgress: (evt) => {
              // optional: could wire a progress bar; overlay shows which file is uploading
            }
          });

          if (response.data?.success) {
            successCount++;
            // Refresh documents after successful upload
            await fetchDocuments();
          } else {
            errorCount++;
            const errorMsg = response.data?.message || 'Upload failed';
            console.error('Upload failed for', file.name, errorMsg);
            toast({
              title: 'Upload Failed',
              description: `${file.name}: ${errorMsg}`,
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          errorCount++;
          
          // Check if unauthorized
          if (err.response?.status === 401) {
            localStorage.removeItem('docLocker_user');
            toast({
              title: 'Session Expired',
              description: 'Please login again.',
              variant: 'destructive',
            });
            navigate('/login');
            return;
          }

          const errorMsg = err.response?.data?.message || err.message || 'Network error during upload';
          console.error('Error uploading', file.name, err);
          toast({
            title: 'Upload Error',
            description: `${file.name}: ${errorMsg}`,
            variant: 'destructive',
          });
        }
      }

      // Refresh documents and profile after uploads
      await fetchDocuments();
      if (user?.id) {
        await fetchAiProfile(user.id, false); // Don't show dialog automatically after upload
      }

      // Show final summary toast only if some files succeeded
      if (successCount > 0) {
        toast({
          title: 'Upload Complete',
          description: `${successCount} file(s) uploaded successfully${errorCount > 0 ? `. ${errorCount} file(s) failed.` : ''}`,
        });
      } else if (errorCount > 0) {
        // All failed - error toasts already shown per file above
        toast({
          title: 'All Uploads Failed',
          description: `All ${errorCount} file(s) failed to upload. Check the error messages above.`,
          variant: 'destructive',
        });
      }

      setShowUpload(false);
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: 'Error',
        description: 'Failed to upload files. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setUploadingOverlay({ active: false, current: 0, total: 0 });
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await fetch('/api/documents', {
        credentials: 'include', // Include cookies for session
      });
      const json = await res.json();
      const docs = json?.data?.documents || [];
      setDocuments(docs);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchAiProfile = async (userId: number | string, showDialog: boolean = false) => {
    try {
      setLoadingProfile(true);
      const res = await fetch(`/api/profile/${userId}`, {
        credentials: 'include', // Include cookies for session
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.success) {
        const profile = json.data?.profile;
        
        // Normalize profile_json: backend may return stringified JSON
        let normalized: any = null;
        if (profile && profile.profile_json) {
          if (typeof profile.profile_json === 'string') {
            try {
              normalized = JSON.parse(profile.profile_json);
            } catch {
              // fallback: leave as string
              normalized = profile.profile_json;
            }
          } else {
            normalized = profile.profile_json;
          }
        }

        if (normalized && typeof normalized === 'object' && Object.keys(normalized).length > 0) {
          setAiProfile(normalized);
          
          if (showDialog) {
            setShowProfileDialog(true);
          }
        } else {
          // No profile or empty profile
          setAiProfile(null);
          
          if (showDialog) {
            setShowProfileDialog(true); // Still show dialog but with empty state
            const message = json.message || 'Upload documents with readable text to generate your AI profile';
            toast({
              title: 'No Profile Generated',
              description: message,
              variant: 'default',
            });
          }
        }
      } else {
        setAiProfile(null);
        if (showDialog) {
          toast({
            title: 'Error',
            description: json.message || 'Failed to load profile',
            variant: 'destructive',
          });
        }
      }
    } catch (e: any) {
      console.error('Error fetching AI profile:', e);
      if (showDialog) {
        toast({
          title: 'Error Loading Profile',
          description: e?.message || 'Failed to load AI profile. Please try again.',
          variant: 'destructive',
        });
      }
      setAiProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDocuments();
      fetchAiProfile(user.id);
    }
  }, [user?.id]);

  if (!user) return null;

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
            <Lock className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">Doc Locker</span>
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

        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 mb-8 bg-card border-border">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                    {documents.length} Documents
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!user?.id) return;
                  setShowProfileDialog(true); // open immediately
                  fetchAiProfile(user.id, true);
                }}
                disabled={loadingProfile}
                className="border-primary/30 hover:border-primary"
              >
                <User className="w-4 h-4 mr-2" />
                {loadingProfile ? 'Loading Profile...' : 'View AI Profile'}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* AI Profile Dialog */}
        <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <User className="w-6 h-6 text-primary" />
                AI Generated Profile
              </DialogTitle>
              <DialogDescription>
                Your one-page professional profile generated from uploaded documents
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4 flex gap-2">
              <Button
                variant="outline"
                disabled={loadingProfile}
                onClick={async () => {
                  try {
                    setRegenerating(true);
                    setLoadingProfile(true);
                    const res = await fetch('/api/profile/regenerate', { method: 'POST', credentials: 'include' });
                    const json = await res.json();
                    if (!res.ok || !json.success) throw new Error(json.message || 'Failed to regenerate');
                    const p = json.data?.profile?.profile_json;
                    if (p) setAiProfile(p);
                    toast({ title: 'Profile regenerated' });
                  } catch (e:any) {
                    toast({ title: 'Regenerate failed', description: e?.message || 'Try again later', variant: 'destructive' });
                  } finally {
                    setRegenerating(false);
                    setLoadingProfile(false);
                  }
                }}
              >
                {regenerating ? 'Regenerating...' : 'Regenerate Profile'}
              </Button>
            </div>
            
            {loadingProfile && (
              <div className="space-y-6 mt-4">
                <Skeleton className="h-8 w-2/3" />
                <div className="p-4 rounded-lg bg-muted/50">
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-64" />
                  </div>
                </div>
                <div>
                  <Skeleton className="h-6 w-32 mb-3" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {!loadingProfile && aiProfile && Object.keys(aiProfile).length > 0 ? (
              <div className="space-y-6 mt-4">
                {/* Name */}
                {aiProfile.name && (
                  <div>
                    <h2 className="text-3xl font-bold mb-2">{aiProfile.name}</h2>
                  </div>
                )}
                
                {/* Summary */}
                {aiProfile.summary && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-base leading-relaxed">{aiProfile.summary}</p>
                  </div>
                )}
                
                {/* Contact Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  {aiProfile.email && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Email</h3>
                      <p className="text-base">{aiProfile.email}</p>
                    </div>
                  )}
                  {aiProfile.education && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Education</h3>
                      <p className="text-base">{aiProfile.education}</p>
                    </div>
                  )}
                </div>
                
                {/* Skills */}
                {Array.isArray(aiProfile.skills) && aiProfile.skills.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiProfile.skills.map((s: string, idx: number) => (
                        <span 
                          key={idx} 
                          className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Certifications */}
                {Array.isArray(aiProfile.certifications) && aiProfile.certifications.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Certifications</h3>
                    <ul className="space-y-2">
                      {aiProfile.certifications.map((c: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-base">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Achievements */}
                {Array.isArray(aiProfile.achievements) && aiProfile.achievements.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Achievements</h3>
                    <ul className="space-y-2">
                      {aiProfile.achievements.map((a: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-base">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (!loadingProfile && (
              <div className="text-center py-8">
                <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Profile Generated Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload documents to generate your AI profile. The profile will be automatically created from your uploaded files.
                </p>
                <Button onClick={() => setShowUpload(true)} className="bg-primary hover:bg-primary/90">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Documents
                </Button>
              </div>
            ))}
          </DialogContent>
        </Dialog>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">My Documents</h2>
            <Button
              onClick={() => setShowUpload(!showUpload)}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
          </div>

          {showUpload && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FileUpload onUpload={handleFileUpload} />
            </motion.div>
          )}
        </motion.div>

        {/* Documents Grid */}
      {uploadingOverlay.active && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-6 bg-card border-border">
            <p className="text-sm text-muted-foreground mb-2">Uploading files...</p>
            <p className="text-lg font-semibold">{uploadingOverlay.current} / {uploadingOverlay.total}</p>
          </Card>
        </div>
      )}
        {loadingDocs && (
          <Card className="p-12 text-center bg-card border-border">
            <p className="text-muted-foreground">Loading documents...</p>
          </Card>
        )}
        
        {!loadingDocs && documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 bg-card border-border hover:border-primary/50 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate mb-1">{doc.filename}</h3>
                    <p className="text-sm text-muted-foreground">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Path: {doc.filepath}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(`/api/document/${doc.id}`,'_blank')}>View</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/document/${doc.id}/download`, '_blank')}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    try {
                      const res = await fetch(`/api/document/${doc.id}`, { method: 'DELETE', credentials: 'include' });
                      if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                      }
                      const contentType = res.headers.get('content-type');
                      if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Server returned non-JSON response');
                      }
                      const json = await res.json();
                      if (!json.success) throw new Error(json.message || 'Delete failed');
                      await fetchDocuments();
                      toast({ title: 'File deleted' });
                      toast({
                        title: 'Regenerate your AI Profile',
                        description: 'To reflect recent file changes, regenerate your one-page profile from the View AI Profile dialog.'
                      });
                    } catch (e:any) {
                      toast({ title: 'Delete failed', description: e?.message || 'Try again', variant: 'destructive' });
                    }
                  }}>Delete</Button>
                </div>
              </Card>
            </motion.div>
            ))}
          </motion.div>
        )}

        {(!loadingDocs && documents.length === 0) && (
          <Card className="p-12 text-center bg-card border-border border-dashed">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first document to get started
            </p>
            <Button onClick={() => setShowUpload(true)} className="bg-primary hover:bg-primary/90">
              <Upload className="w-4 h-4 mr-2" />
              Upload Now
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
