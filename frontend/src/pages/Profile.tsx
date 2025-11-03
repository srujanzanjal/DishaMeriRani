import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
      // Upload each file one by one
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('document', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            credentials: 'include', // Include cookies for session
            // Don't set Content-Type - let browser set it with boundary for FormData
            body: formData,
          });

          // Check if response is unauthorized (401) - not logged in
          if (response.status === 401) {
            localStorage.removeItem('docLocker_user');
            throw new Error('Please login again.');
          }

          let result;
          try {
            result = await response.json();
          } catch (jsonError) {
            // If response is not JSON, get text
            const text = await response.text();
            throw new Error(`Server error: ${text || response.statusText}`);
          }

          if (response.ok && result.success) {
            successCount++;
          } else {
            errorCount++;
            const errorMsg = result.message || result.error || 'Upload failed';
            console.error('Upload failed for', file.name, errorMsg);
            // Show individual file error
            toast({
              title: 'Upload Failed',
              description: `${file.name}: ${errorMsg}`,
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          errorCount++;
          const errorMsg = err?.message || 'Network error during upload';
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
        await fetchAiProfile(user.id);
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

  const fetchAiProfile = async (userId: number | string) => {
    try {
      setLoadingProfile(true);
      const res = await fetch(`/api/profile/${userId}`, {
        credentials: 'include', // Include cookies for session
      });
      const json = await res.json();
      setAiProfile(json?.data?.profile?.profile_json || null);
    } catch (e) {
      // ignore
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
                onClick={() => user?.id && fetchAiProfile(user.id)}
                className="border-primary/30 hover:border-primary"
              >
                <User className="w-4 h-4 mr-2" />
                {loadingProfile ? 'Loading Profile...' : 'View AI Profile'}
              </Button>
            </div>
            {aiProfile && (
              <div className="mt-6 rounded-lg p-4 border border-primary/20">
                <h2 className="text-xl font-semibold mb-2">AI Profile</h2>
                {aiProfile.summary && <p className="mb-4 text-sm text-muted-foreground">{aiProfile.summary}</p>}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Education</h3>
                    <p className="text-sm text-muted-foreground">{aiProfile.education || '—'}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Email</h3>
                    <p className="text-sm text-muted-foreground">{aiProfile.email || user.email}</p>
                  </div>
                </div>
                {Array.isArray(aiProfile.skills) && aiProfile.skills.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium">Skills</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {aiProfile.skills.map((s: string) => (
                        <span key={s} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(aiProfile.certifications) && aiProfile.certifications.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium">Certifications</h3>
                    <ul className="list-disc ml-5 text-sm text-muted-foreground">
                      {aiProfile.certifications.map((c: string) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(aiProfile.achievements) && aiProfile.achievements.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium">Achievements</h3>
                    <ul className="list-disc ml-5 text-sm text-muted-foreground">
                      {aiProfile.achievements.map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

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
