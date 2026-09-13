'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { WorkspaceView } from '@/components/intelligence/workspace/WorkspaceView';
import { useAuth } from '@/contexts/AuthContext';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [workspace, setWorkspace] = useState<any>(null);
  const [sourcingObject, setSourcingObject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const buyerParam = user?.id ? `?buyerId=${user.id}` : '';
    fetch(`/api/intelligence/workspaces/${id}${buyerParam}`)
      .then((res) => {
        if (!res.ok) throw new Error('Workspace not found');
        return res.json();
      })
      .then((data) => {
        if (data.workspace) {
          setWorkspace(data.workspace);
          setSourcingObject(data.sourcingObject);
        } else {
          setWorkspace(null);
        }
      })
      .catch(() => {
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-500">
          Loading Decision Workspace...
        </div>
      </AppLayout>
    );
  }

  if (!workspace) {
    return (
      <AppLayout>
        <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6 bg-zinc-50/50 dark:bg-zinc-950 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Workspace Not Found</h2>
          <p className="text-sm text-zinc-500 max-w-sm mb-6">
            This sourcing workspace does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/intelligence"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Intelligence Home</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-56px)] bg-zinc-50/50 dark:bg-zinc-950">
        <WorkspaceView workspace={workspace} sourcingObject={sourcingObject} />
      </div>
    </AppLayout>
  );
}
