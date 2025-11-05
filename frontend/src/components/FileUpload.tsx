import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onUpload: (files: File[]) => void; // parent will call backend; keeping for compatibility
}

const FileUpload = ({ onUpload }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const isValidFileType = (file: File): boolean => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    return validTypes.includes(file.type);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => {
        if (!isValidFileType(file)) {
          alert(`File type not supported: ${file.name}. Please upload PDF, JPG, or PNG files only.`);
          return false;
        }
        return true;
      });
      
      if (newFiles.length > 0) {
        setFiles(prev => [...prev, ...newFiles]);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => {
        if (!isValidFileType(file)) {
          alert(`File type not supported: ${file.name}. Please upload PDF, JPG, or PNG files only.`);
          return false;
        }
        return true;
      });
      
      if (newFiles.length > 0) {
        setFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      // Just pass files to parent component - let parent handle the actual upload
      // This avoids duplicate uploads
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI
      setProgress(100);
      onUpload(files);
      setFiles([]);
    } catch (e) {
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card className="p-6 mb-6 bg-card border-border">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
      >
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold mb-2">
          Drag and drop files here
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse (PDF, JPG, PNG)
        </p>
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          className="hidden"
        />
        <label htmlFor="file-upload">
          <Button type="button" variant="outline" className="cursor-pointer" asChild>
            <span>Choose Files</span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 space-y-2"
        >
          <p className="font-semibold mb-2">{files.length} file(s) selected:</p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {uploading && (
            <div className="mt-4">
              <Progress value={progress} className="mb-2" />
              <p className="text-sm text-center text-muted-foreground">
                Uploading... {progress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-4 bg-primary hover:bg-primary/90"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </motion.div>
      )}
    </Card>
  );
};

export default FileUpload;
