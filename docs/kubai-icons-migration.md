# Kubai Icons migration

Installed `kubai-icons-react@0.3.1`. Icons use direct imports, preserve size and inherited color, and animate on their parent control.

Scope: Dashboard V2, study room navigation, chat sidebar/header/composer, message actions, web sources, voice pill, and artifact workspace.

| Previous icon | Kubai icon |
| --- | --- |
| ArrowLeft | arrow-left |
| ArrowRight | arrow-right |
| ArrowUpRight | arrow-up-right |
| AtSign | at-sign |
| BookMarked | book-marked |
| BookOpen | book-open |
| Brain | brain |
| CalendarDays | calendar-days |
| ChartLine | chart-line |
| Check | circle-check |
| ChevronDown | chevron-down |
| CircleHelp | circle-help |
| ClipboardList | clipboard |
| Copy | copy |
| Crown | crown |
| Download | download |
| Ellipsis | more-horizontal |
| ExternalLink | external-link |
| File | file |
| FileText | file-text |
| Flame | flame |
| FolderOpen | folder-open |
| Gem | gem |
| Globe | globe |
| Grid2X2 | grid |
| Hand | hand |
| Headphones | headphones |
| History | history |
| ImageIcon | image |
| Info | info |
| Layers | layers |
| LayoutDashboard | grid |
| Leaf | leaf |
| List | list |
| ListChecks | list-checks |
| Mail | mail |
| Menu | menu |
| MessageCircle | message-circle |
| MessageSquarePlus | message-square-plus |
| Mic | mic |
| Network | network |
| NotebookPen | notebook-pen |
| PanelLeftClose | sidebar |
| PanelLeftOpen | sidebar |
| Paperclip | paperclip |
| Pencil | pencil |
| PhoneCall | phone-call |
| Plus | circle-plus |
| RefreshCw | sync |
| Save | save |
| Search | search |
| Send | send |
| Share2 | share |
| Sparkles | sparkles |
| Square | square |
| Terminal | terminal |
| Trash2 | trash |
| Trophy | trophy |
| X | circle-x |

Navigation illustrations now use book-open, notebook-pen, network, list-checks, layers, folder-open, message-circle, headphones, sticky-note; dashboard destinations use grid, notebook-pen, message-circle, book-open, trophy, calendar-days, graduation-cap. Their existing dimensions and dominant colors are retained.

Not replaced: House (no house/home equivalent), Upload (cloud-upload changes the meaning of local attachment), Zap (no lightning equivalent), Loader2 (functional spinner, not a decorative hover animation). Momo, provider logos and legacy V1 multi-color artwork remain original.

Chat/artifact layout: quieter surfaces, no duplicate header/footer borders, flat action buttons, readable message spacing and mobile touch targets. No chat, AI, persistence or authorization logic changed.

References: https://icons.kubai.design/docs/react/ and https://icons.kubai.design/data/index.json
