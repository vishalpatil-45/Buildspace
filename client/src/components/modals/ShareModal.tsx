import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Loader2, Crown, Edit2, Eye } from 'lucide-react';
import { projectsApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';
import { getInitials, userColor } from '@/utils/helpers';

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
}

interface ShareModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function ShareModal({ projectId, projectName, onClose }: ShareModalProps) {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.getMembers(projectId)
      .then((res) => setMembers(res.data.members))
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await projectsApi.inviteMember(projectId, inviteEmail.trim(), inviteRole);
      toast.success(`Invited ${inviteEmail}`);
      setInviteEmail('');
      // Refresh members
      const res = await projectsApi.getMembers(projectId);
      setMembers(res.data.members);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the project?`)) return;
    setRemovingId(memberId);
    try {
      await projectsApi.removeMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const roleIcon: Record<string, React.ReactNode> = {
    owner: <Crown size={13} className="text-amber-400" />,
    editor: <Edit2 size={13} className="text-brand-400" />,
    viewer: <Eye size={13} className="text-slate-400" />,
  };

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">Share Project</h2>
            <p className="text-sm text-slate-400 mt-0.5">{projectName}</p>
          </div>
          <button
            id="close-share-modal"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Invite form */}
        {isOwner && (
          <form onSubmit={handleInvite} className="p-6 border-b border-white/5">
            <label className="block text-sm font-medium text-slate-300 mb-2">Invite by email</label>
            <div className="flex gap-2">
              <input
                id="invite-email-input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="input-field flex-1"
                required
              />
              <select
                id="invite-role-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                id="invite-submit-btn"
                type="submit"
                disabled={inviting}
                className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
              >
                {inviting ? <Loader2 size={14} className="spinner" /> : <UserPlus size={14} />}
                Invite
              </button>
            </div>
          </form>
        )}

        {/* Members list */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </h3>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="spinner text-slate-500" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: userColor(member.user_id) }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {member.name}
                      {member.user_id === user?.id && (
                        <span className="text-xs text-slate-500 ml-1">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs">
                      {roleIcon[member.role]}
                      <span className="text-slate-400 capitalize">{member.role}</span>
                    </span>
                    {isOwner && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member.user_id, member.name)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors"
                        title="Remove member"
                      >
                        {removingId === member.user_id ? (
                          <Loader2 size={12} className="spinner" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
