import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { projectsApi, authApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { formatTime } from '@/utils/helpers';

interface Project {
  id: string;
  name: string;
  owner_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const res = await projectsApi.list();
      setProjects(res.data.projects);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const res = await projectsApi.create(newProjectName.trim());
      setProjects((prev) => [res.data.project, ...prev]);
      setNewProjectName('');
      setShowCreate(false);
      toast.success('Project created!');
      navigate(`/project/${res.data.project.id}`);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await projectsApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  };

  const roleColor: Record<string, string> = {
    owner: 'text-tertiary',
    editor: 'text-primary',
    viewer: 'text-outline',
  };

  const statusDot: Record<string, string> = {
    owner: 'bg-tertiary',
    editor: 'bg-primary',
    viewer: 'bg-outline',
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-on-surface">
      {/* ── Top Nav ── */}
      <header className="flex justify-between items-center w-full px-md h-8 z-40 bg-surface border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-md">
          <span className="font-headline text-[18px] font-black text-on-surface tracking-tight">
            Nexus Code
          </span>
          <nav className="hidden md:flex gap-xs">
            {['File', 'Edit', 'View', 'Go'].map((item) => (
              <span key={item} className="label-caps text-on-surface-variant hover:bg-surface-variant hover:text-on-surface px-2 py-1 cursor-pointer transition-colors">
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-sm">
          <button
            id="create-project-btn"
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            New Project
          </button>
          <div className="w-px h-4 bg-outline-variant" />
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">notifications</span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">settings</span>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-xs"
            title="Sign out"
          >
            <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Side Nav ── */}
        <aside className="w-16 flex flex-col justify-between items-center py-md bg-surface-container border-r border-outline-variant flex-shrink-0">
          <div className="flex flex-col items-center gap-md w-full">
            <div className="w-10 h-10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            </div>
            <div className="flex flex-col items-center w-full gap-xs">
              <div className="w-full flex justify-center border-l-2 border-primary text-primary bg-surface-variant py-2">
                <span className="material-symbols-outlined">folder_open</span>
              </div>
              {[
                { icon: 'search' },
                { icon: 'grid_view' },
                { icon: 'extension' },
                { icon: 'group' },
              ].map(({ icon }) => (
                <div key={icon} className="sidebar-item">
                  <span className="material-symbols-outlined">{icon}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center w-full gap-xs">
            <div className="sidebar-item">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <div className="sidebar-item">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto">
          {/* Metrics bar */}
          <section className="grid grid-cols-4 border-b border-outline-variant">
            {[
              { label: 'Projects', value: projects.length.toString(), sub: 'Total', color: 'text-primary' },
              { label: 'Active Files', value: '—', sub: 'Across projects', color: 'text-secondary' },
              { label: 'Collaborators', value: '—', sub: 'Shared access', color: 'text-tertiary' },
              { label: 'Last Active', value: projects.length > 0 ? formatTime(projects[0]?.updated_at) : '—', sub: 'Most recent', color: 'text-on-surface' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="p-md border-r border-outline-variant last:border-r-0">
                <span className="label-caps text-outline">{label}</span>
                <div className="flex items-baseline gap-sm mt-xs">
                  <span className={`text-headline-lg ${color}`}>{value}</span>
                  <span className="font-code text-[11px] text-outline">{sub}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Create project form */}
          {showCreate && (
            <div className="mx-md mt-md p-md bg-surface-container border border-outline-variant animate-slide-up">
              <h2 className="label-caps text-on-surface mb-sm">New Project</h2>
              <form onSubmit={handleCreate} className="flex gap-sm">
                <input
                  id="project-name-input"
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="input-field flex-1"
                  placeholder="e.g. my-awesome-app"
                />
                <button
                  id="create-project-submit"
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="btn-primary"
                >
                  {creating ? (
                    <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px]">add</span>
                  )}
                  Create
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* Project grid */}
          <div className="p-md">
            <div className="flex items-center justify-between mb-md">
              <span className="label-caps text-on-surface-variant">
                Explorer — {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 gap-sm text-outline">
                <span className="material-symbols-outlined animate-spin">refresh</span>
                Loading projects…
              </div>
            ) : projects.length === 0 && !showCreate ? (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-surface-container border-2 border-dashed border-outline-variant flex items-center justify-center mx-auto mb-md">
                  <span className="material-symbols-outlined text-outline text-[32px]">folder_open</span>
                </div>
                <h3 className="text-headline-md text-on-surface mb-sm">No projects yet</h3>
                <p className="text-on-surface-variant text-[13px] mb-md">Create your first project to start coding collaboratively</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Create Project
                </button>
              </div>
            ) : (
              <div className="grid gap-md grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="card p-md flex flex-col justify-between min-h-[160px] cursor-pointer group"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-headline-md text-on-surface truncate flex-1 mr-sm">
                          {project.name}
                        </h3>
                        <button
                          id={`delete-project-${project.id}`}
                          onClick={(e) => handleDelete(project.id, project.name, e)}
                          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded hover:bg-error-container text-outline hover:text-error transition-all"
                          title="Delete project"
                        >
                          {deletingId === project.id ? (
                            <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          )}
                        </button>
                      </div>
                      <p className="font-code text-[11px] text-outline mt-xs">
                        Modified {formatTime(project.updated_at)}
                      </p>
                    </div>

                    <div className="flex justify-between items-end mt-lg">
                      <div className="flex items-center gap-xs">
                        <div className={`w-2 h-2 rounded-full ${statusDot[project.role] ?? 'bg-outline'}`} />
                        <span className={`label-caps ${roleColor[project.role] ?? 'text-outline'}`}>
                          {project.role}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-[14px] text-outline group-hover:text-primary transition-colors">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))}

                {/* New project card */}
                <div
                  className="card p-md flex flex-col items-center justify-center min-h-[160px] cursor-pointer group border-dashed hover:border-primary"
                  onClick={() => setShowCreate(true)}
                >
                  <span className="material-symbols-outlined text-outline group-hover:text-primary text-[32px] transition-colors">add_circle</span>
                  <span className="label-caps text-outline group-hover:text-primary mt-sm transition-colors">New Project</span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Right: Activity Feed ── */}
        <aside className="w-72 border-l border-outline-variant flex flex-col bg-surface-container flex-shrink-0 hidden lg:flex">
          <div className="p-md border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">Recent Activity</h2>
            <button onClick={loadProjects} className="btn-ghost w-6 h-6">
              <span className="material-symbols-outlined text-[16px]">refresh</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-md space-y-md">
            {projects.slice(0, 6).map((p) => (
              <div key={p.id} className="flex gap-sm items-start cursor-pointer" onClick={() => navigate(`/project/${p.id}`)}>
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-[16px]">folder</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-on-surface font-semibold truncate">{p.name}</p>
                  <p className="font-code text-[11px] text-outline mt-[2px] italic truncate">
                    Modified {formatTime(p.updated_at)}
                  </p>
                  <span className={`label-caps ${roleColor[p.role] ?? 'text-outline'} mt-xs block`}>{p.role}</span>
                </div>
              </div>
            ))}
            {projects.length === 0 && !loading && (
              <p className="text-outline text-[13px] text-center mt-lg">No recent activity</p>
            )}
          </div>
          <button className="p-sm text-center label-caps text-outline hover:text-on-surface border-t border-outline-variant transition-colors">
            View All Activity
          </button>
        </aside>
      </div>

      {/* ── Status Bar ── */}
      <footer className="flex items-center justify-between px-md h-6 bg-primary border-t border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-md h-full">
          <div className="status-item">
            <span className="material-symbols-outlined text-[14px]">call_split</span>
            <span>Branch: main</span>
          </div>
          <div className="status-item">
            <span className="material-symbols-outlined text-[14px]">sync</span>
          </div>
        </div>
        <div className="flex items-center gap-md h-full">
          <span className="font-code text-[12px] text-on-primary opacity-80">Nexus Code v1.0</span>
          <div className="status-item">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed" />
            <span>{user?.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
