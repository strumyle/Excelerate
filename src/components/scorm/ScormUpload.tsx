import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ScormPackage {
  package_id: string;
  title: string;
  version: string;
  entry_point: string;
}

interface ScormUploadProps {
  onPackageUploaded?: (packageData: ScormPackage) => void;
}

export function ScormUpload({ onPackageUploaded }: ScormUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedPackages, setUploadedPackages] = useState<ScormPackage[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a ZIP file containing your SCORM package');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.functions.invoke('scorm-upload', {
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      const packageData: ScormPackage = {
        package_id: data.package_id,
        title: data.title,
        version: data.version,
        entry_point: data.entry_point
      };

      setUploadedPackages(prev => [...prev, packageData]);
      toast.success('SCORM package uploaded successfully!');
      
      if (onPackageUploaded) {
        onPackageUploaded(packageData);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload SCORM package');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [onPackageUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    maxFiles: 1,
    disabled: uploading
  });

  const startPackage = async (packageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('scorm-start', {
        body: { packageId }
      });

      if (error) throw error;

      if (data?.launch_url) {
        window.open(data.launch_url, '_blank');
      }
    } catch (error: any) {
      console.error('Start error:', error);
      toast.error('Failed to start SCORM package');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload SCORM Package
          </CardTitle>
          <CardDescription>
            Upload a SCORM 1.2 or SCORM 2004 compatible ZIP package to create interactive learning content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              
              {uploading ? (
                <div className="space-y-2 w-full max-w-xs">
                  <p className="text-sm text-muted-foreground">Uploading SCORM package...</p>
                  <Progress value={uploadProgress} />
                  <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-lg font-medium">
                      {isDragActive ? 'Drop the ZIP file here' : 'Drag & drop your SCORM ZIP file here'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse files
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">SCORM 1.2</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">SCORM 2004</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">ZIP only</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {uploadedPackages.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium">Recently Uploaded</h3>
              {uploadedPackages.map((pkg) => (
                <div
                  key={pkg.package_id}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{pkg.title}</p>
                      <p className="text-sm text-muted-foreground">
                        SCORM {pkg.version} • Entry: {pkg.entry_point}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startPackage(pkg.package_id)}
                  >
                    Launch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            SCORM Package Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium">Supported Features:</h4>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• SCORM 1.2 and SCORM 2004 compatibility</li>
              <li>• Progress tracking and bookmarking</li>
              <li>• Score reporting and completion status</li>
              <li>• Suspend data for resume functionality</li>
              <li>• Certificate generation on completion</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Package Structure:</h4>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• Must contain imsmanifest.xml in root</li>
              <li>• Launch file (usually index.html or similar)</li>
              <li>• All referenced assets and resources</li>
              <li>• Valid SCORM metadata</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}