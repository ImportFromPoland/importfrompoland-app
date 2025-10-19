# Latest Updates Summary - Poprawki i Nowe Funkcje

## ✅ Naprawione (Fixed)

### 1. **Profitability Calculation** ✅
**Problem**: Net cost nie był mnożony przez ilość
**Rozwiązanie**: Teraz prawidłowo:
- **Total Item Cost (PLN)** = Σ(net_cost_pln × quantity)
- **Item Logistics (PLN)** = Σ(logistics_cost_pln × quantity)
- **Total Cost (EUR)** = (suma kosztów PLN) / 3.1
- **Global Logistics (EUR)** = order.logistics_cost (nowe pole)
- **Net Profit** = Client Pays - Total Costs

### 2. **Warehouse "Spakowane" Checkbox** ✅
**Problem**: Checkbox nie działał, przekierowywał do zakładki "Dostawy"
**Rozwiązanie**: 
- Dodano kolumnę `packed` do order_items
- Checkbox teraz działa poprawnie
- Zachowuje stan (checked/unchecked)
- Tylko aktywny gdy item jest "Dostarczone"

### 3. **Logistics Costs - Globalne** ✅
**Problem**: Brakowało miejsca na ogólne koszty logistyczne
**Rozwiązanie**:
- Dodano `logistics_cost` (EUR) w Order Settings
- Labeled as "Overall Logistics Cost (EUR)"
- Używane w kalkulacji profitability
- Osobno od per-item logistics

## 🆕 Nowe Funkcje

### 1. **Zaopatrzenie (Procurement) Module** ✅
**Location**: `/admin/zaopatrzenie`

#### Funkcje:
- **Tworzenie zamówień do dostawców**
- **Grupowanie pozycji** z zamówienia klienta
- **Śledzenie statusu**:
  - `ordered` - Zamówione
  - `partially_received` - Częściowo odebrane
  - `received` - Odebrane (archiwum)
- **Informacje**:
  - Data zamówienia
  - Numer zamówienia u dostawcy
  - Przewidywana data dostawy
  - Wartość zamówienia (PLN)
  - Notatki

#### Dwie Zakładki:
1. **Aktywne zamówienia** - Zamówienia w trakcie realizacji
2. **Archiwum** - Zamówienia odebrane (tylko widok)

### 2. **Nowa Struktura Bazy Danych**

#### Tabela: `supplier_orders`
```sql
- id (UUID)
- order_id (link do zamówienia klienta)
- supplier_name (nazwa dostawcy)
- order_date (data zamówienia)
- expected_delivery_date (przewidywana dostawa)
- supplier_order_number (numer u dostawcy)
- total_cost_pln (wartość zamówienia)
- status (ordered/partially_received/received)
- notes
```

#### Tabela: `supplier_order_items`
```sql
- id (UUID)
- supplier_order_id
- order_item_id
- quantity_ordered (ilość zamówiona)
- quantity_received (ilość odebrana)
- unit_cost_pln (cena jednostkowa)
```

#### Nowe Kolumny w `order_items`:
```sql
- packed (BOOLEAN) - czy spakowane
- packed_at (TIMESTAMPTZ) - kiedy spakowano
```

## ⚠️ Znane Problemy (Known Issues)

### 1. VAT Calculation Issue
**Problem**: Zmiana VAT z 23% na 0% zmienia gross na net zamiast zachować net constant

**Dlaczego**: System przechowuje GROSS price (PLN), przelicza gdy VAT się zmienia

**Workaround**:
1. ✅ Ustaw właściwy VAT PRZED potwierdzeniem zamówienia
2. ✅ Sprawdź EU VAT number klienta najpierw
3. ❌ NIE zmieniaj VAT po potwierdzeniu

**Permanent Fix** (TODO):
- Zablokować ceny po potwierdzeniu
- LUB przechowywać NET price zamiast GROSS
- LUB dodać ostrzeżenie przy zmianie VAT

### 2. Warehouse Dostawy - Obecnie Grupowane Po Dostawcy
**Problem**: Obecnie dostawy są grupowane tylko po nazwie dostawcy, nie po pojedynczym zamówieniu

**Rozwiązanie** (następny krok):
- Warehouse będzie pokazywał dostawy grupowane po `supplier_orders`
- Każde zamówienie do dostawcy będzie osobno
- Po pełnym odbiorze → automatycznie do archiwum
- Archiwum tylko dla admin/superadmin

## 🚀 Wymagane Migracje

### Migration 14: Procurement & Supplier Orders
**File**: `20240101000014_procurement_and_supplier_orders.sql`

**Dodaje**:
- Tabela `supplier_orders`
- Tabela `supplier_order_items`
- Kolumna `packed` w order_items
- Kolumna `packed_at` w order_items
- RLS policies
- Indexes

### Jak Uruchomić:
1. Supabase Dashboard → SQL Editor
2. Skopiuj: `C:\Users\micha\importfrompoland-app\supabase\migrations\20240101000014_procurement_and_supplier_orders.sql`
3. Wklej do SQL Editor
4. Click "Run"
5. Hard refresh browser (Ctrl+Shift+R)

## 📊 Nowy Workflow

### Krok 1: Klient Składa Zamówienie
- Status: `submitted`

### Krok 2: Admin Potwierdza
- Status: `confirmed`
- Ustawia VAT (23% lub 0%) ← **NIE ZMIENIAJ POTEM!**

### Krok 3: Zaopatrzenie (NOWE!)
**Location**: `/admin/zaopatrzenie`

1. Kliknij "Nowe zamówienie do dostawcy"
2. Wybierz zamówienie klienta
3. Wybierz pozycje do zamówienia
4. Podaj:
   - Nazwę dostawcy
   - Data zamówienia
   - Numer zamówienia u dostawcy
   - Cena jednostkowa (PLN) dla każdej pozycji
   - Przewidywana data dostawy
   - Notatki
5. Zapisz

**System automatycznie**:
- Oznaczy items jako "ordered_from_supplier"
- Utworzy supplier_order
- Połączy z order_items

### Krok 4: Magazyn Odbiera
**Location**: `/admin/warehouse` → Zakładka "Dostawy"

- Dostawy pogrupowane po supplier_orders (po migracji)
- Zaznacz "Dostarczone" gdy przyjdzie
- Status zamówienia aktualizuje się:
  - Wszystko odebrane → `received` (archiwum)
  - Część odebrana → `partially_received`

### Krok 5: Magazyn Pakuje
**Location**: `/admin/warehouse` → "Zamówienia klientów"

1. Zobacz adres klienta
2. Zaznacz "Dostarczone" (auto z kroku 4)
3. Zaznacz "Spakowane" ✅ **Teraz działa!**
4. Wygeneruj etykiety
5. "Oznacz jako wysłane"

### Krok 6: Admin Widzi Zysk
- Total Item Cost (PLN) - z supplier_orders
- Item Logistics (PLN) - z order_items
- Global Logistics (EUR) - z orders
- **Net Profit** (zielony/czerwony)

## 📁 Pliki Zmienione

### Nowe:
1. `supabase/migrations/20240101000014_procurement_and_supplier_orders.sql`
2. `app/admin/zaopatrzenie/page.tsx`
3. `LATEST_UPDATES_SUMMARY.md` (ten plik)

### Zmodyfikowane:
1. `app/admin/orders/[id]/page.tsx` - Profitability fix, global logistics
2. `app/admin/warehouse/page.tsx` - Fixed packed checkbox
3. `app/admin/layout.tsx` - Added Zaopatrzenie nav

## 🔜 Następne Kroki

### Natychmiast:
1. ✅ **Uruchom Migration 14**
2. ✅ Hard refresh (Ctrl+Shift+R)
3. ✅ Przetestuj nowy moduł Zaopatrzenie

### Do Zrobienia:
1. **Create Supplier Order Form** (`/admin/zaopatrzenie/new`)
2. **Supplier Order Detail Page** (`/admin/zaopatrzenie/[id]`)
3. **Update Warehouse Dostawy** - Group by supplier_orders instead of supplier name
4. **Auto-archive** - When supplier_order fully received
5. **PDF Labels** - Implement actual generation

### W Przyszłości:
1. Fix VAT recalculation issue
2. Partial shipments (sub-orders)
3. Email notifications
4. Tracking numbers
5. Automated reports

## 🧪 Testowanie

### Checklist:
1. ✅ Uruchom migration 14
2. ✅ Sprawdź profitability calculation (mnożenie przez quantity)
3. ✅ Sprawdź "Spakowane" checkbox (nie przekierowuje)
4. ✅ Sprawdź Global Logistics field
5. ✅ Odwiedź `/admin/zaopatrzenie`
6. ⏳ Utwórz supplier order (po zrobieniu formularza)
7. ⏳ Sprawdź warehouse dostawy (po update)

## 📞 Wsparcie

**Problemy?**
1. Check browser console (F12)
2. Verify migration 14 ran
3. Check RLS policies
4. Hard refresh browser

**Najczęstsze błędy**:
- "Column doesn't exist" → Run migration 14
- "Policy violation" → Check user role (admin/staff_admin)
- Checkbox nie działa → Hard refresh po migracji
- Blank page → Ctrl+Shift+R

