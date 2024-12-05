import React from 'react';
import { Sun, Moon, User, Bell } from 'lucide-react';
import { useTheme } from '../../lib/hooks/useTheme';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex flex-1 items-center justify-end space-x-4">
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg p-2 hover:bg-accent"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            className="h-9 w-9 rounded-lg p-2 hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 rounded-lg p-2 hover:bg-accent"
            aria-label="User menu"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}