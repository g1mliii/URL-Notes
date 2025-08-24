'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { 
  Home, 
  Globe, 
  FileText, 
  Settings, 
  X,
  ChevronDown,
  Plus,
  Tag
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  user: SupabaseUser | null
}

export function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const { 
    viewMode, 
    setViewMode, 
    sidebarOpen, 
    setSidebarOpen,
    compactMode,
    setCompactMode,
    getTags
  } = useAppStore()

  const tags = getTags()

  const navigationItems = [
    {
      id: 'all',
      label: 'All Notes',
      icon: Home,
      description: 'View all your notes'
    },
    {
      id: 'site',
      label: 'This Site',
      icon: Globe,
      description: 'Notes for current domain'
    },
    {
      id: 'page',
      label: 'This Page',
      icon: FileText,
      description: 'Notes for current URL'
    }
  ]

  return (
    <>
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white/10 backdrop-blur-md border-r border-white/20 transform transition-transform duration-300 ease-in-out lg:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent 
          user={user}
          onClose={onClose}
          isMobile={true}
        />
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:block fixed inset-y-0 left-0 z-40 bg-white/10 backdrop-blur-md border-r border-white/20 transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
        compactMode && sidebarOpen && "w-48"
      )}>
        <SidebarContent 
          user={user}
          onClose={() => setSidebarOpen(!sidebarOpen)}
          isMobile={false}
        />
      </div>
    </>
  )
}

interface SidebarContentProps {
  user: SupabaseUser | null
  onClose: () => void
  isMobile: boolean
}

function SidebarContent({ user, onClose, isMobile }: SidebarContentProps) {
  const { 
    viewMode, 
    setViewMode, 
    compactMode,
    setCompactMode,
    getTags
  } = useAppStore()

  const tags = getTags()

  const navigationItems = [
    {
      id: 'all',
      label: 'All Notes',
      icon: Home,
      description: 'View all your notes'
    },
    {
      id: 'site',
      label: 'This Site',
      icon: Globe,
      description: 'Notes for current domain'
    },
    {
      id: 'page',
      label: 'This Page',
      icon: FileText,
      description: 'Notes for current URL'
    }
  ]

  return (
    <div className="flex flex-col h-full">
             {/* Header */}
       <div className="flex items-center justify-between p-4 border-b border-white/20">
         <h1 className="text-xl font-bold text-white">
           URL Notes
         </h1>
         {isMobile && (
           <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
             <X size={20} />
           </Button>
         )}
       </div>

             {/* Navigation */}
       <nav className="flex-1 p-4 space-y-2">
         {navigationItems.map((item) => {
           const Icon = item.icon
           return (
             <button
               key={item.id}
               onClick={() => setViewMode(item.id as any)}
               className={cn(
                 "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                 viewMode === item.id
                   ? "bg-blue-500/20 border border-blue-400/40 text-blue-300"
                   : "text-white/80 hover:bg-white/20 hover:text-white"
               )}
             >
               <Icon size={20} />
               <div className="flex-1">
                 <div className="font-medium">{item.label}</div>
                 <div className="text-xs text-white/60">
                   {item.description}
                 </div>
               </div>
             </button>
           )
         })}
       </nav>

             {/* Quick Actions */}
       <div className="p-4 border-t border-white/20">
         <Button className="w-full mb-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
           <Plus size={16} className="mr-2" />
           New Note
         </Button>
         
         <Button variant="outline" className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30">
           <Tag size={16} className="mr-2" />
           Manage Tags
         </Button>
       </div>

             {/* Tags Section */}
       {tags.length > 0 && (
         <div className="flex-1 p-4 border-t border-white/20">
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-sm font-medium text-white/80">
               Popular Tags
             </h3>
             <ChevronDown size={16} className="text-white/50" />
           </div>
           <div className="space-y-1">
             {tags.slice(0, 5).map((tag) => (
               <button
                 key={tag}
                 className="w-full text-left px-2 py-1 text-sm text-white/60 hover:bg-white/20 hover:text-white rounded transition-colors"
               >
                 #{tag}
               </button>
             ))}
           </div>
         </div>
       )}

             {/* User Section */}
       <div className="p-4 border-t border-white/20">
         <div className="flex items-center space-x-3">
           <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-lg">
             {user?.email?.charAt(0).toUpperCase() || 'U'}
           </div>
           <div className="flex-1 min-w-0">
             <div className="text-sm font-medium text-white truncate">
               {user?.email}
             </div>
             <div className="text-xs text-white/60">
               Premium
             </div>
           </div>
         </div>
       </div>

             {/* Settings */}
       <div className="p-4 border-t border-white/20">
         <Button variant="ghost" className="w-full justify-start text-white/80 hover:bg-white/20 hover:text-white">
           <Settings size={16} className="mr-2" />
           Settings
         </Button>
       </div>
    </div>
  )
}
