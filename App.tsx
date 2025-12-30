
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  X,
  Trash2,
  Download,
  Upload,
  Settings as SettingsIcon,
  PlusCircle
} from 'lucide-react';
import { 
  Activity, 
  DevOpsStatus, 
  TaskType, 
  ProjectConfig 
} from './types';
import { 
  TASK_TYPE_LABELS,
  PALETTE 
} from './constants';
import { db } from './db';

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterDevOps, setFilterDevOps] = useState<DevOpsStatus | 'All'>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [lastUsedProject, setLastUsedProject] = useState<string>('');
  const [lastUsedType, setLastUsedType] = useState<TaskType>(TaskType.TASK);
  const [isLoading, setIsLoading] = useState(true);

  // Project Management State
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await db.init();
        const savedProjects = await db.getProjects();
        setProjects(savedProjects);

        const savedActivities = await db.getActivities();
        setActivities(savedActivities);

        const lup = await db.getSetting<string>('lastUsedProject');
        const lut = await db.getSetting<TaskType>('lastUsedType');
        if (lup) setLastUsedProject(lup);
        if (lut) setLastUsedType(lut);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleAddActivity = async (newActivity: Omit<Activity, 'id'>) => {
    const activity: Activity = {
      ...newActivity,
      id: Math.random().toString(36).substr(2, 9)
    };
    await db.saveActivity(activity);
    setActivities(prev => [activity, ...prev]);
    
    setLastUsedProject(activity.project);
    setLastUsedType(activity.type);
    await db.setSetting('lastUsedProject', activity.project);
    await db.setSetting('lastUsedType', activity.type);
    
    setIsFormOpen(false);
  };

  const handleUpdateActivity = async (id: string, updates: Partial<Activity>) => {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    const updated = { ...activity, ...updates };
    await db.saveActivity(updated);
    setActivities(prev => prev.map(a => a.id === id ? updated : a));
  };

  const handleDeleteActivity = async (id: string) => {
    if (window.confirm('¿Eliminar esta actividad?')) {
      await db.deleteActivity(id);
      setActivities(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    if (projects.some(p => p.name.toLowerCase() === newProjectName.toLowerCase())) {
      alert("El proyecto ya existe");
      return;
    }
    const newProj = { name: newProjectName.trim(), color: selectedColor };
    await db.saveProject(newProj);
    setProjects(prev => [...prev, newProj]);
    setNewProjectName('');
  };

  const handleDeleteProject = async (name: string) => {
    if (window.confirm(`¿Eliminar proyecto "${name}"? Las actividades asociadas NO se borrarán.`)) {
      const transaction = (db as any).db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      store.delete(name);
      setProjects(prev => prev.filter(p => p.name !== name));
      if (filterProject === name) setFilterProject('All');
    }
  };

  const handleExport = async () => {
    const data = await db.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempo-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const merge = window.confirm('¿Fusionar con datos actuales? (Cancelar reemplazará todo)');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        await db.importData(content, merge);
        setActivities(await db.getActivities());
        setProjects(await db.getProjects());
        alert('Datos importados');
      } catch (err) {
        alert('Error al importar');
      }
    };
    reader.readAsText(file);
  };

  const filteredActivities = useMemo(() => {
    return activities
      .filter(a => {
        const matchesDevOps = filterDevOps === 'All' || a.devOpsStatus === filterDevOps;
        const matchesProject = filterProject === 'All' || a.project === filterProject;
        const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             a.project.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesDevOps && matchesProject && matchesSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, filterDevOps, filterProject, searchTerm]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayHours = activities.filter(a => a.date === todayStr).reduce((sum, a) => sum + a.hours, 0);
    const pendingCount = activities.filter(a => a.devOpsStatus === DevOpsStatus.PENDING).length;
    return { todayHours, pendingCount };
  }, [activities]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-2 h-2 rounded-full bg-black animate-ping" /></div>;

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-6 sm:px-10 py-10 sm:py-16 pb-32">
      <header className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-5">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">Tempo</h1>
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-2 rounded-full transition-colors hover:bg-gray-100 ${isSettingsOpen ? 'text-gray-900 bg-gray-50' : 'text-gray-300'}`}>
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-10">
            <Stat label="Hoy" value={`${stats.todayHours.toFixed(1)}h`} />
            <Stat label="Pendiente" value={stats.pendingCount} highlight={stats.pendingCount > 0} />
          </div>
        </div>

        {isSettingsOpen && (
          <div className="mb-10 p-8 bg-white border border-gray-100 rounded-[2rem] shadow-sm space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Project Management */}
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Gestión de Proyectos</h3>
              <div className="flex flex-wrap gap-3 mb-6">
                {projects.length === 0 && <p className="text-xs text-gray-400 italic">No hay proyectos. Crea uno para empezar.</p>}
                {projects.map(p => (
                  <div key={p.name} className="flex items-center gap-3 bg-gray-50 border border-gray-100 pl-3 pr-2 py-1.5 rounded-full group transition-all hover:border-gray-300">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-medium text-gray-700">{p.name}</span>
                    <button onClick={() => handleDeleteProject(p.name)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddProject} className="flex flex-col sm:flex-row gap-4 max-w-xl">
                <input 
                  type="text" placeholder="Nombre del proyecto..." 
                  className="flex-1 text-sm bg-gray-50 border-none focus:ring-1 focus:ring-gray-900 rounded-2xl px-5 py-3 transition-all"
                  value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  {PALETTE.map(c => (
                    <button 
                      key={c} type="button" onClick={() => setSelectedColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${selectedColor === c ? 'scale-125 border-2 border-white ring-2 ring-gray-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-black transition-all">
                  <PlusCircle className="w-4 h-4" /> Agregar
                </button>
              </form>
            </div>

            <div className="h-[1px] bg-gray-50" />

            {/* Import/Export */}
            <div className="flex flex-col sm:flex-row gap-4">
              <SettingsButton icon={<Download className="w-4 h-4" />} label="Exportar Backup" onClick={handleExport} />
              <SettingsButton icon={<Upload className="w-4 h-4" />} label="Importar Backup" onClick={() => fileInputRef.current?.click()} />
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="relative group flex-1 max-w-lg">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-gray-900 transition-colors" />
            <input 
              type="text" placeholder="Buscar actividad o proyecto..." 
              className="w-full pl-8 py-3 bg-transparent border-b border-gray-100 focus:border-gray-900 focus:outline-none text-sm transition-all"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            <FilterChip active={filterDevOps === 'All' && filterProject === 'All'} onClick={() => { setFilterDevOps('All'); setFilterProject('All'); }} label="Todo" />
            <FilterChip active={filterDevOps === DevOpsStatus.PENDING} onClick={() => setFilterDevOps(DevOpsStatus.PENDING)} label="Pendientes" />
            {projects.length > 0 && <div className="flex-shrink-0 w-[1px] h-4 bg-gray-200 mx-2" />}
            {projects.map(p => (
              <FilterChip key={p.name} active={filterProject === p.name} onClick={() => setFilterProject(filterProject === p.name ? 'All' : p.name)} label={p.name} dotColor={p.color} />
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="py-32 text-center">
            <p className="text-gray-300 text-base font-light italic">
              {activities.length === 0 ? 'Empieza agregando tu primera actividad' : 'No se encontraron resultados para tu búsqueda'}
            </p>
          </div>
        ) : (
          filteredActivities.map((activity, index) => {
            const isNewDay = index === 0 || activity.date !== filteredActivities[index - 1].date;
            return (
              <React.Fragment key={activity.id}>
                {isNewDay && (
                  <div className="pt-10 pb-4">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.25em]">
                      {activity.date === new Date().toISOString().split('T')[0] ? 'Hoy, ' + activity.date : activity.date}
                    </span>
                  </div>
                )}
                <ActivityRow activity={activity} onUpdate={(u) => handleUpdateActivity(activity.id, u)} onDelete={() => handleDeleteActivity(activity.id)} />
              </React.Fragment>
            );
          })
        )}
      </div>

      <button 
        onClick={() => {
          if (projects.length === 0) {
            alert("Primero debes crear al menos un proyecto en la configuración.");
            setIsSettingsOpen(true);
            return;
          }
          setIsFormOpen(true);
        }}
        className="fixed bottom-10 right-10 px-8 py-4 bg-gray-900 text-white rounded-[2rem] shadow-2xl hover:bg-black transition-all flex items-center gap-3 z-40 active:scale-95 group"
      >
        <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
        <span className="text-xs font-bold tracking-widest uppercase">Nueva Actividad</span>
      </button>

      {isFormOpen && (
        <QuickAddModal 
          onClose={() => setIsFormOpen(false)} onSubmit={handleAddActivity}
          projects={projects} defaultProject={lastUsedProject} defaultType={lastUsedType}
        />
      )}
    </div>
  );
};

// --- Sub-Components ---

const Stat: React.FC<{ label: string, value: string | number, highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="text-right">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl sm:text-2xl font-semibold tracking-tight ${highlight ? 'text-orange-500' : 'text-gray-900'}`}>{value}</p>
  </div>
);

const SettingsButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 rounded-2xl transition-all">
    {icon} {label}
  </button>
);

const FilterChip: React.FC<{ active: boolean, onClick: () => void, label: string, dotColor?: string }> = ({ active, onClick, label, dotColor }) => (
  <button onClick={onClick} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-semibold transition-all ${active ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-500 hover:border-gray-300'}`}>
    {dotColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />}
    {label}
  </button>
);

const ActivityRow: React.FC<{ activity: Activity, onUpdate: (u: Partial<Activity>) => void, onDelete: () => void }> = ({ activity, onUpdate, onDelete }) => {
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingDevOpsId, setIsEditingDevOpsId] = useState(false);
  
  const toggleStatus = () => {
    const newStatus = activity.devOpsStatus === DevOpsStatus.PENDING ? DevOpsStatus.LOADED : DevOpsStatus.PENDING;
    onUpdate({ devOpsStatus: newStatus });
    if (newStatus === DevOpsStatus.LOADED && !activity.devOpsId) setIsEditingDevOpsId(true);
  };

  return (
    <div className="group flex items-center py-5 px-6 bg-white border border-gray-50 rounded-[1.5rem] hover:border-gray-200 transition-all hover:shadow-sm">
      <div className="w-2 h-2 rounded-full mr-6 flex-shrink-0" style={{ backgroundColor: activity.projectColor }} />
      
      <div className="flex-1 min-w-0 pr-6">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{activity.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{activity.project}</span>
          <span className="text-gray-200 text-xs">•</span>
          <span className="text-[10px] text-gray-400 font-semibold">{TASK_TYPE_LABELS[activity.type]}</span>
          {activity.devOpsId && (
            <>
              <span className="text-gray-200 text-xs">•</span>
              <span className="text-[10px] font-mono text-blue-500 font-bold">#{activity.devOpsId}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right min-w-[3rem]">
          {isEditingHours ? (
            <input autoFocus type="number" step="0.5" className="w-12 bg-transparent text-right text-sm font-bold border-b border-gray-900 focus:outline-none" value={activity.hours} onBlur={() => setIsEditingHours(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingHours(false)} onChange={(e) => onUpdate({ hours: parseFloat(e.target.value) || 0 })} />
          ) : (
            <span onClick={() => setIsEditingHours(true)} className="text-base font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">
              {activity.hours.toFixed(1)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">h</span>
            </span>
          )}
        </div>

        <div className="flex items-center min-w-[5rem] justify-end">
          {isEditingDevOpsId ? (
            <div className="flex items-center bg-gray-50 rounded-xl px-2 py-1 border border-gray-100">
              <span className="text-[10px] text-gray-400 mr-1 font-mono">#</span>
              <input autoFocus className="w-14 bg-transparent text-xs font-mono focus:outline-none" placeholder="ID" value={activity.devOpsId || ''} onBlur={() => setIsEditingDevOpsId(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingDevOpsId(false)} onChange={(e) => onUpdate({ devOpsId: parseInt(e.target.value) || undefined })} />
            </div>
          ) : (
            <button 
              onClick={toggleStatus} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                activity.devOpsStatus === DevOpsStatus.LOADED 
                  ? 'text-gray-400 hover:text-green-600' 
                  : 'text-orange-500 bg-orange-50 hover:bg-orange-100'
              }`}
            >
              {activity.devOpsStatus === DevOpsStatus.LOADED ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="hidden md:inline">{activity.devOpsStatus}</span>
            </button>
          )}
        </div>

        <button onClick={onDelete} className="p-2 text-gray-200 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const QuickAddModal: React.FC<{ onClose: () => void, onSubmit: (a: any) => void, projects: ProjectConfig[], defaultProject: string, defaultType: TaskType }> = ({ onClose, onSubmit, projects, defaultProject, defaultType }) => {
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('1');
  const [project, setProject] = useState(defaultProject || (projects[0]?.name || ''));
  const [type, setType] = useState<TaskType>(defaultType);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !hours || !project) return;
    const pData = projects.find(p => p.name === project);
    onSubmit({ title, hours: parseFloat(hours), project, projectColor: pData?.color || '#ccc', type, date, devOpsStatus: DevOpsStatus.PENDING });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/10 backdrop-blur-xl px-6">
      <div className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl p-10 sm:p-14 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Nueva Entrada</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">¿Qué hiciste?</label>
            <input autoFocus placeholder="Título de la actividad..." required className="w-full text-xl bg-transparent border-b border-gray-100 focus:border-gray-900 focus:outline-none py-3 transition-all placeholder:text-gray-100" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Horas</label>
              <input type="number" step="0.5" required className="w-full bg-transparent border-b border-gray-100 focus:border-gray-900 focus:outline-none py-2 text-base font-semibold" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Fecha</label>
              <input type="date" required className="w-full bg-transparent border-b border-gray-100 focus:border-gray-900 focus:outline-none py-2 text-base" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Proyecto</label>
            <div className="flex flex-wrap gap-3">
              {projects.map(p => (
                <button key={p.name} type="button" onClick={() => setProject(p.name)} className={`px-5 py-2.5 rounded-full text-[11px] font-bold border transition-all ${project === p.name ? 'bg-gray-900 border-gray-900 text-white shadow-xl scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'}`}>{p.name}</button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Tipo de Tarea</label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setType(v as TaskType)} className={`px-5 py-2.5 rounded-full text-[11px] font-bold border transition-all ${type === v ? 'bg-gray-100 border-gray-100 text-gray-900' : 'bg-transparent border-gray-50 text-gray-300 hover:text-gray-400'}`}>{l}</button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-bold text-sm hover:bg-black transition-all shadow-xl active:scale-[0.98] mt-6 uppercase tracking-[0.2em]">Guardar Registro</button>
        </form>
      </div>
    </div>
  );
};

export default App;
