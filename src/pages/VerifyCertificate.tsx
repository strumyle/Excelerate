import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, CheckCircle, XCircle, Calendar, User, BookOpen } from 'lucide-react';

interface CertificateVerification {
  valid: boolean;
  serial?: string;
  course_title?: string;
  user_full_name?: string;
  issued_at?: string;
  score?: number;
  error?: string;
}

export default function VerifyCertificate() {
  const { serial } = useParams<{ serial: string }>();
  const [verification, setVerification] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serial) return;
    verifyCertificate();
  }, [serial]);

  const verifyCertificate = async () => {
    if (!serial) return;

    try {
      setLoading(true);
      
      // Call the verify-certificate edge function directly
      const response = await fetch(
        `https://xrfiltyxdviefanplykg.supabase.co/functions/v1/verify-certificate?serial=${encodeURIComponent(serial)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setVerification(data);
    } catch (error) {
      console.error('Error verifying certificate:', error);
      setVerification({
        valid: false,
        error: 'Failed to verify certificate. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verifying certificate...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            {verification?.valid ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {verification?.valid ? 'Valid Certificate' : 'Invalid Certificate'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {verification?.valid ? (
            <div className="space-y-6">
              {/* Certificate Status */}
              <div className="text-center">
                <Badge className="text-lg px-4 py-2">
                  <Award className="h-5 w-5 mr-2" />
                  Verified Certificate
                </Badge>
              </div>

              {/* Certificate Details */}
              <div className="grid gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Learner</p>
                    <p className="font-semibold">{verification.user_full_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Course</p>
                    <p className="font-semibold">{verification.course_title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Issued</p>
                    <p className="font-semibold">
                      {verification.issued_at && formatDate(verification.issued_at)}
                    </p>
                  </div>
                </div>

                {verification.score && (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <Award className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="font-semibold">{Math.round(verification.score)}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Certificate ID */}
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">Certificate ID</p>
                <p className="font-mono text-sm bg-muted px-3 py-1 rounded mt-1">
                  {verification.serial}
                </p>
              </div>

              {/* Issued By */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Issued by</p>
                <p className="font-semibold text-primary">Excelerate Learning Platform</p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {verification?.error || 'This certificate could not be verified. It may be invalid, expired, or the certificate ID is incorrect.'}
              </p>
              
              {serial && (
                <div>
                  <p className="text-sm text-muted-foreground">Certificate ID searched:</p>
                  <p className="font-mono text-sm bg-muted px-3 py-1 rounded mt-1">
                    {serial}
                  </p>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                Please verify the certificate ID and try again, or contact the issuing organization.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}