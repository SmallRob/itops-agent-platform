import clsx from 'clsx';
import { Server, HardDrive } from 'lucide-react';

export interface DockerHostOption {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  address: string;
  available: boolean;
  version?: string;
  message?: string;
}

interface Props {
  hosts: DockerHostOption[];
  value: string;
  onChange: (host: string) => void;
  isLoading?: boolean;
}

/** Docker 主机切换条（容器管理 / 镜像管理共用） */
export default function DockerHostSwitcher({ hosts, value, onChange, isLoading }: Props) {
  if (hosts.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {hosts.map((host) => {
        const active = host.id === value;
        return (
          <button
            key={host.id}
            onClick={() => onChange(host.id)}
            title={
              host.available
                ? `${host.address}${host.version ? ` · Docker ${host.version}` : ''}`
                : host.message || '不可用'
            }
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border',
              active
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'bg-surface text-text-secondary border-border hover:text-text-primary'
            )}
          >
            {host.type === 'local' ? (
              <HardDrive className="w-3.5 h-3.5" />
            ) : (
              <Server className="w-3.5 h-3.5" />
            )}
            <span className={clsx('w-2 h-2 rounded-full', host.available ? 'bg-status-success' : 'bg-status-failed')} />
            {host.name}
            {host.version && (
              <span className={clsx('font-mono text-[10px]', active ? 'text-primary/80' : 'text-text-tertiary')}>
                {host.version}
              </span>
            )}
          </button>
        );
      })}
      {isLoading && <span className="text-xs text-text-tertiary">加载主机中...</span>}
    </div>
  );
}