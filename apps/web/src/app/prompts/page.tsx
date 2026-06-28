'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { PromptTemplate } from '@voxpilot/shared';

export default function PromptsPage() {
  const { token } = useAuthStore();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadPrompts() {
    if (!token) return;
    try {
      const res = await api.getPrompts(token);
      setPrompts(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPrompts(); }, [token]);

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setName('');
    setDescription('');
    setSystemPrompt('');
  }

  function startEdit(p: PromptTemplate) {
    setEditing(p.id);
    setCreating(false);
    setName(p.name);
    setDescription(p.description || '');
    setSystemPrompt(p.systemPrompt);
  }

  function cancel() {
    setCreating(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!token || !name || !systemPrompt) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updatePrompt(token, editing, { name, description, systemPrompt });
      } else {
        await api.createPrompt(token, { name, description, systemPrompt });
      }
      cancel();
      await loadPrompts();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm('Delete this template?')) return;
    await api.deletePrompt(token, id);
    await loadPrompts();
  }

  const isEditing = creating || editing;

  return (
    <div className="max-w-4xl space-y-6 animate-[fade-in_0.2s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Prompt Templates</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Save reusable prompts for your AI calls
          </p>
        </div>
        {!isEditing && (
          <button onClick={startCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {editing ? 'Edit Template' : 'New Template'}
          </h3>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="e.g. Appointment Reminder" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-base" placeholder="Brief description" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="input-base min-h-[200px] resize-y font-mono text-[13px] leading-relaxed"
              placeholder="You are Sarah, a friendly receptionist..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !name || !systemPrompt} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button onClick={cancel} className="btn-ghost">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : prompts.length === 0 && !isEditing ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
          <p className="text-lg font-medium text-[var(--color-text-secondary)]">No templates yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            Create prompt templates to reuse across calls
          </p>
          <button onClick={startCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p.id} className="card p-5 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{p.description}</p>
                  )}
                  <pre className="text-[12px] text-[var(--color-text-secondary)] mt-3 bg-[var(--color-bg-tertiary)] p-3 rounded-lg whitespace-pre-wrap font-mono leading-relaxed max-h-[100px] overflow-hidden">
                    {p.systemPrompt}
                  </pre>
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-[var(--color-danger-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
