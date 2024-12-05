import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Compass, 
  Network, 
  Library, 
  Settings,
  Menu
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Discover', href: '/', icon: Compass },
  { name: 'Connections', href: '/connections', icon: Network },
  { name: 'My Library', href: '/library', icon: Library },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className={cn(
      "flex flex-col h-screen bg-white border-r transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4">
        {!collapsed && <h1 className="text-xl font-semibold">Navigator</h1>}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={20} />
        </button>
      </div>
      
      <nav className="flex-1 p-2 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2 rounded-lg transition-colors",
              "hover:bg-gray-100",
              isActive ? "bg-blue-50 text-blue-700" : "text-gray-700",
              collapsed && "justify-center"
            )}
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!collapsed && (
              <span className="ml-3">{item.name}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}