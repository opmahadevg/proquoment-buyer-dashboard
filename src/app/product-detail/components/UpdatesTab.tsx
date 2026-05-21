'use client';
import React, { useState } from 'react';
import { Users, CheckCircle } from 'lucide-react';
import { UpdateTask, UpdateItem } from '@/lib/productDetailData';

interface UpdatesTabProps {
  tasks: UpdateTask[];
  updates: UpdateItem[];
}

export default function UpdatesTab({ tasks, updates }: UpdatesTabProps) {
  const [includeResolved, setIncludeResolved] = useState(false);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--foreground)] text-[var(--foreground)] bg-white text-xs font-medium">
            All
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-primary font-medium">Include resolved updates</span>
          <button
            onClick={() => setIncludeResolved(!includeResolved)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
              includeResolved ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                includeResolved ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tasks section */}
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-3">
        {tasks?.length} Task{tasks?.length !== 1 ? 's' : ''}
      </h3>
      {tasks?.map((task) => (
        <div
          key={task?.id}
          className="border border-[var(--border)] rounded-xl px-5 py-4 mb-4 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer"
        >
          <span className="inline-block px-3 py-0.5 rounded-full border border-red-400 text-red-500 text-xs font-medium mb-3">
            {task?.type}
          </span>
          <p className="text-sm font-semibold text-[var(--foreground)] mb-1">{task?.title}</p>
          <p className="text-sm text-[var(--muted-foreground)] mb-3 leading-relaxed line-clamp-2">
            {task?.description}
          </p>
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-3">
              <span>{task?.date}</span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {task?.supplier}
              </span>
            </div>
            <span>{task?.replies} Replies</span>
          </div>
        </div>
      ))}

      {/* Updates section */}
      <div className="flex items-center justify-between mb-4 mt-6">
        <h3 className="text-base font-semibold text-[var(--foreground)]">
          {updates?.length} Update{updates?.length !== 1 ? 's' : ''}
        </h3>
        <button className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] active:scale-95 transition-all">
          Message us
        </button>
      </div>

      {updates?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--foreground)] mb-1">
              No unresolved updates
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              There are no unresolved updates for this product
            </p>
          </div>
        </div>
      ) : (
        updates?.map((upd) => (
          <div
            key={upd?.id}
            className="border border-[var(--border)] rounded-xl px-5 py-4 mb-4 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer"
          >
            <p className="text-sm font-semibold text-[var(--foreground)] mb-1">{upd?.title}</p>
            <p className="text-sm text-[var(--muted-foreground)] mb-3 leading-relaxed">
              {upd?.description}
            </p>
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <div className="flex items-center gap-3">
                <span>{upd?.date}</span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {upd?.supplier}
                </span>
              </div>
              <span>{upd?.replies} Replies</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
