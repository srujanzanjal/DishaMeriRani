import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, ArrowLeft, FileText, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { mockStudents, Student } from '@/data/mockData';

const StudentDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin');
      return;
    }

    const foundStudent = mockStudents.find(s => s.id === id);
    if (foundStudent) {
      setStudent(foundStudent);
    } else {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, user, id, navigate]);

  if (!student) return null;

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
            <span className="text-2xl font-bold">Student Details</span>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/dashboard')}
            className="border-primary/30 hover:border-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </motion.div>

        {/* Student Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-8 mb-8 bg-card border-border">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{student.name}</h1>
                <p className="text-muted-foreground text-lg">{student.email}</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="px-4 py-2 rounded-full bg-primary/10 text-primary">
                    {student.documents.length} Documents
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Documents Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold mb-6">Uploaded Documents</h2>
          
          {student.documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {student.documents.map((doc, index) => (
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
                        <h3 className="font-semibold truncate mb-1">{doc.name}</h3>
                        <p className="text-sm text-muted-foreground">{doc.type} • {doc.size}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded {doc.uploadDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" className="flex-1">
                        View
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center bg-card border-border border-dashed">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No documents uploaded</h3>
              <p className="text-muted-foreground">
                This student hasn't uploaded any documents yet
              </p>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default StudentDetail;
