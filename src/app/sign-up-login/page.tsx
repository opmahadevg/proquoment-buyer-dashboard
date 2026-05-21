import React, { Suspense } from 'react';
import AuthContent from './components/AuthContent';

export default function SignUpLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
          Loading...
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
