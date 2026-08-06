UI Kit Prompt — Bakery ERP Style
Copy and paste this into your new Next.js project.
Step 1: Install Dependencies
npm install clsx tailwind-merge lucide-react framer-motion react-hot-toast date-fns tailwindcss-animate class-variance-authority
npm install -D tailwindcss postcss autoprefixer @tailwindcss/typography
npx tailwindcss init -p
Step 2: tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
Step 3: app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 38 92% 50%;
    --primary-foreground: 355.7 100% 97.3%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 38 92% 50%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 38 92% 50%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 38 92% 50%;
  }
}

@layer base {
  * { border-color: hsl(var(--border)); }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { @apply bg-gray-300 dark:bg-gray-600 rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-gray-400 dark:bg-gray-500; }
Step 4: lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol = '$'): string {
  const num = isNaN(amount) ? 0 : amount;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  return (num < 0 ? '-' : '') + symbol + formatted;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string, fmt = 'MMM dd, yyyy'): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
}

export function formatDateTime(date: Date | string): string {
  if (!date) return '—';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
Step 5: UI Style Guide — Use These Class Patterns
Page Layout:
<div className="space-y-6">
  {/* Page header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Page Title</h1>
      <p className="text-gray-500 text-sm mt-0.5">Page description</p>
    </div>
    <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">
      <Plus size={16} /> New Action
    </button>
  </div>
</div>
Stats Cards (3-4 column grid):
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map((s) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
        <s.icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{s.label}</p>
        <p className="text-lg font-bold text-gray-800 dark:text-white">{s.value}</p>
      </div>
    </div>
  ))}
</div>
Filters Bar:
<div className="flex flex-wrap gap-3">
  <div className="relative">
    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input type="text" placeholder="Search..." value={search} onChange={...}
      className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-56" />
  </div>
  {['All', 'Option1', 'Option2'].map((s) => (
    <button key={s} onClick={...}
      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
        activeFilter === s ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}>
      {s}
    </button>
  ))}
</div>
Table:
<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
          <th className="px-5 py-3 text-left">Column</th>
          <th className="px-5 py-3 text-right">Amount</th>
          <th className="px-5 py-3 text-left">Status</th>
          <th className="px-5 py-3">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
            <td className="px-5 py-3 font-medium text-gray-800 dark:text-white">{item.name}</td>
            <td className="px-5 py-3 text-right font-semibold">{formatCurrency(item.total)}</td>
            <td className="px-5 py-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[item.state]}`}>
                {item.state}
              </span>
            </td>
            <td className="px-5 py-3">
              <div className="flex items-center gap-1.5">
                {/* Action buttons here */}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
Empty state:
<div className="text-center py-16">
  <Package size={48} className="mx-auto text-gray-300 mb-3" />
  <p className="text-gray-500">No items found.</p>
</div>
Loading state:
<div className="flex items-center justify-center py-20 text-gray-400">
  <RefreshCw size={20} className="animate-spin mr-2" />
  Loading…
</div>
Modal:
<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white">Modal Title</h2>
      <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
    </div>
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Form fields */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
          {saving ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </form>
  </div>
</div>
Form Inputs:
// Text input
<input type="text"
  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />

// Select
<select
  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
  <option value="">Select...</option>
</select>

// Textarea
<textarea rows={3}
  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />

// Label
<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Field Label</label>
Action Buttons (inside tables):
// Primary (amber)
<button className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600">Action</button>

// Secondary (gray outline)
<button className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg">Edit</button>

// Success (green)
<button className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600">Receive</button>

// Info (blue)
<button className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600">Confirm</button>

// Purple
<button className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs hover:bg-purple-600">Pay</button>

// Danger icon
<button className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>

// "Add Item" link-style
<button className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
  <Plus size={13} /> Add Item
</button>
Status Badges:
const STATUS_CLASSES = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
  invoiced: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-600',
  done: 'bg-green-100 text-green-700',
};

<span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[state] || 'bg-gray-100'}`}>
  {state}
</span>
Toast notifications:
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

// In layout:
<Toaster position="top-right" toastOptions={{
  duration: 4000,
  style: { borderRadius: '12px', background: '#333', color: '#fff', fontSize: '14px' },
}} />

// In components:
toast.success('Operation successful!');
toast.error('Something went wrong');
toast('Neutral message');
Summary card / highlight row (e.g. subtotal/discount/tax):
<div className="grid grid-cols-3 gap-4 text-sm p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
  <div>
    <p className="text-xs text-gray-500">Subtotal</p>
    <p className="font-semibold text-gray-800 dark:text-white">{formatCurrency(value)}</p>
  </div>
  <div>
    <p className="text-xs text-gray-500">Discount</p>
    <p className="font-semibold text-gray-800 dark:text-white">{formatCurrency(value)}</p>
  </div>
  <div>
    <p className="text-xs text-gray-500">Tax</p>
    <p className="font-semibold text-gray-800 dark:text-white">{formatCurrency(value)}</p>
  </div>
</div>
Notes / Info box:
<p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
  {notes}
</p>
Dark mode support — every colored element uses the dark: variant:
- Text: text-gray-800 dark:text-white
- Subtle text: text-gray-500 dark:text-gray-400
- Backgrounds: bg-white dark:bg-gray-800
- Borders: border-gray-200 dark:border-gray-700
- Hover: hover:bg-gray-50 dark:hover:bg-gray-700/30
- Badge bg: bg-amber-50 dark:bg-amber-900/20
Color palette used:
Usage	Light	Dark
Primary / accent	amber-500 (#f59e0b)	amber-500
Primary hover	amber-600	amber-600
Success	green-500 / green-100	green-500 / green-900/20
Danger	red-600 / red-50	red-600 / red-900/20
Info	blue-500 / blue-100	blue-500 / blue-900/20
Warning	orange-500 / orange-100	orange-500 / orange-900/20
Purple	purple-500 / purple-100	purple-500 / purple-900/20
Neutral bg	gray-50	gray-700/30
Card bg	white	gray-800
Border	gray-200	gray-700
That's it. Copy the dependencies, tailwind.config.js, globals.css, and lib/utils.ts into your project. Then use the class patterns above to build your UI. The style is consistent, clean, and supports dark mode out of the box.
▣  Plan · DeepSeek V4 Flash Free · 2m 42s