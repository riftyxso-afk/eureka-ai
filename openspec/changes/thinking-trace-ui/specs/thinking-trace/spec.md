## Purpose

Menyediakan trace berpikir AI yang expandable dengan 4 varian (Steps, Reasoning, Search, Coding) agar pengguna melihat langkah AI secara transparan dan tetap bisa collapse setelah selesai.

## ADDED Requirements

### Requirement: Render thinking trace dengan 4 varian

Sistem SHALL merender komponen thinking trace dengan varian `Steps`, `Reasoning`, `Search`, `Coding` sesuai prop `variant`, menampilkan header `Thinking`/`Searching the web`/`Running tools` saat `working` dan `Thought for 4 seconds`/`Searched the web`/`Ran 3 tools` saat `settled`.

#### Scenario: Varian Steps saat working
- **WHEN** `variant="Steps"` dan `stage < 3` (working)
- **THEN** header menampilkan `Thinking` dengan shimmer dan daftar step dengan spinner pada step aktif

#### Scenario: Varian Search menampilkan query dan sources
- **WHEN** `variant="Search"` dan `stage >= 2`
- **THEN** tampil query `best waffle cone supplier` dan 3 baris `Joy Cone`/`WebstaurantStore`/`The Konery` sebagai link

#### Scenario: Varian Coding menampilkan diff
- **WHEN** `variant="Coding"` 
- **THEN** baris `Edit` menampilkan `+74 −41` dengan warna hijau/merah

### Requirement: Expandable dan auto-settled

Sistem SHALL membuat trace auto-expanded saat `stage 1-3` dan collapsed saat `stage 0` atau `stage >=4` kecuali user toggle manual via `manualExpanded`, dan SHALL mempertahankan `minHeight` 176 saat `working` atau `expanded`.

#### Scenario: Auto-expanded saat working
- **WHEN** `stage` berpindah dari 0 ke 1
- **THEN** `expanded` menjadi true tanpa interaksi user

#### Scenario: Manual toggle
- **WHEN** user klik header button saat `autoExpanded=true`
- **THEN** `manualExpanded` toggle dan `expanded` mengikuti manual

#### Scenario: Settled callback
- **WHEN** `stage` mencapai `>=3` (settled) pertama kali
- **THEN** `onSettled` dipanggil sekali

### Requirement: Animasi dan aksesibilitas

Sistem SHALL menganimasikan header shimmer, row `fade-up` stagger 120ms, dan `spin` pada spinner, serta menyediakan `aria-expanded` pada header button dan `role="status"` pada teks working/done.

#### Scenario: Shimmer saat working
- **WHEN** `working=true`
- **THEN** teks `Thinking` memakai `background-clip:text` dengan `linear-gradient` shimmer `1.4s infinite`

#### Scenario: Fade-up row
- **WHEN** row baru muncul (`visible` bertambah)
- **THEN** row menganimasi `fade-up 320ms cubic-bezier(0.23,1,0.32,1)` dengan delay `i*120ms`

### Requirement: Interaksi row Search dan Coding

Sistem SHALL membuat row `Search` sebagai link `a` ke `href` dengan `target="_blank"`, dan row `Coding` sebagai button toggle `selectedTool` dengan state `aria-pressed`.

#### Scenario: Klik source Search
- **WHEN** user klik `Joy Cone` row
- **THEN** browser buka `https://joycone.com/fs_products/waffle-cones/` di tab baru

#### Scenario: Klik tool Coding
- **WHEN** user klik `Read` row
- **THEN** `selectedTool` toggle antara `null` dan `Read` dan row background jadi `bg-inset` saat terpilih
