'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, Search, Bell, User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

import { User as SupabaseUser } from '@supabase/supabase-js'

interface HeaderProps {
  onMenuClick: () => void
  user: SupabaseUser | null
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { signOut } = useAuth()
  const { searchQuery, setSearchQuery, compactMode } = useAppStore()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and search */}
        <div className="flex items-center space-x-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden text-white hover:bg-white/20"
          >
            <Menu size={20} />
          </Button>

          {/* Search bar */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60" size={16} />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-10 w-64 lg:w-80 bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
                compactMode && "w-48 lg:w-64"
              )}
            />
          </div>
        </div>

        {/* Right side - Notifications and user menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/20">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-400 rounded-full shadow-lg"></span>
          </Button>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="rounded-full hover:bg-white/20"
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-lg">
                {getInitials(user?.email || '')}
              </div>
            </Button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 z-50">
                <div className="py-2">
                  <div className="px-4 py-3 text-sm text-white border-b border-white/20">
                    <div className="font-medium text-white">{user?.email}</div>
                    <div className="text-xs text-white/60">Premium User</div>
                  </div>
                  
                  <button
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/20 flex items-center space-x-3 transition-colors"
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </button>
                  
                  <button
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/20 flex items-center space-x-3 transition-colors"
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/20 flex items-center space-x-3 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="sm:hidden mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60" size={16} />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
        </div>
      </div>
    </header>
  )
}
