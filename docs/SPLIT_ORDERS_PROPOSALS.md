# Propozycje rozwiązania Split Orders (zamówienia wysyłane w 2+ turach)

## Kontekst problemu
Zamówienie klienta może być realizowane częściami: gdy część produktów dochodzi na magazyn, jest pakowana i wysyłana (tura 1), pozostałe produkty jadą w kolejnej turze (tura 2+), dopóki całość nie zostanie dostarczona.

## Aktualny stan bazy

| Tabela | Kluczowe pola | Obserwacje |
|--------|---------------|------------|
| `orders` | id, number, status, company_id | Status: partially_dispatched, dispatched, partially_delivered, delivered |
| `order_items` | order_id, received_in_warehouse, packed, packed_at | Śledzenie na poziomie pozycji |
| `shipments` | order_id, carrier, tracking_number, shipped_at | **Już wspiera wiele wysyłek na 1 zamówienie** (order_id nie jest UNIQUE) |
| `supplier_orders` | order_id, supplier_name, status | Zaopatrzenie u dostawców |

**Istniejące możliwości:**
- Tabela `shipments` – relacja N:1 z orders (jedno zamówienie może mieć wiele wysyłek)
- Brak powiązania shipment ↔ order_items – nie wiadomo, które pozycje są w której wysyłce
- Status `partially_dispatched` jest już w enumie

---

## Rozwiązanie 1: Rozszerzenie shipment + order_items (minimalna zmiana)

**Idea:** Do każdej pozycji dodajemy `shipment_id`. Dzięki temu wiemy, w której turze wysłano każdą pozycję.

### Migracja

```sql
-- Nowa kolumna w order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id);

-- Indeks dla zapytań
CREATE INDEX IF NOT EXISTS idx_order_items_shipment ON order_items(shipment_id);
```

### Flow
1. Magazyn klika „Częściowo wysłane” → tworzy `shipments` (tura 1), ustawia `order_items.shipment_id` dla spakowanych pozycji, status zamówienia = `partially_dispatched`.
2. Przy kolejnej turze → nowy `shipments`, kolejne pozycje dostają nowy `shipment_id`.
3. Gdy wszystkie pozycje mają `shipment_id` → status zamówienia = `dispatched`.

### Zalety
- Mała zmiana (1 kolumna)
- Bez nowych tabel
- Jasne powiązanie: pozycja → konkretna wysyłka

### Wady
- `order_items` przechowuje logikę wysyłki (mieszanie odpowiedzialności)
- Przy wielu turach: dużo update’ów na `order_items`

---

## Rozwiązanie 2: Tabela shipment_items (klasyczne, czyste)

**Idea:** Tabela łącząca `shipments` z `order_items` – każda tura ma listę pozycji.

### Migracja

```sql
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity_shipped NUMERIC(12,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shipment_id, order_item_id)
);

CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_order_item ON shipment_items(order_item_id);

-- RLS
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_shipment_items" ON shipment_items FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));
```

### Flow
1. Magazyn: „Częściowo wysłane” → insert `shipments`, insert `shipment_items` dla spakowanych pozycji.
2. Kolejna tura → nowy `shipments` + nowe wiersze w `shipment_items`.

### Zalety
- Czysta normalizacja
- Możliwość częściowego wysłania pozycji (quantity_shipped)
- Łatwa historia: ile, kiedy i w której turze
- `order_items` bez zmian, brak migracji danych

### Wady
- Nowa tabela
- Zapytania wymagają joinów (shipments → shipment_items → order_items)

---

## Rozwiązanie 3: Tabela shipment_batches + rozszerzenie shipments

**Idea:** Wydzielamy pojęcie „partii wysyłkowej” (batch), powiązanej z zamówieniem i konkretnymi pozycjami.

### Migracja

```sql
-- Rozszerzenie shipments o numer tury
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS batch_label TEXT; -- np. "Tura 1", "Tura 2"

-- Tabela: które pozycje w której partii
CREATE TABLE shipment_batch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shipment_id, order_item_id)
);

-- Lub prostsza wersja: shipment_items z batch_number w shipments
```

### Flow
1. Tura 1: `shipments` (batch_number=1), `shipment_batch_items` dla pozycji z tury 1.
2. Tura 2: `shipments` (batch_number=2), kolejne pozycje.

### Zalety
- Jawna numeracja tur
- Można łatwo pokazać „Tura 1 / Tura 2” w UI

### Wady
- Bardziej rozbudowany model niż Rozwiązanie 2
- `batch_label` może być wyliczane z `batch_number`, więc kolumna opcjonalna

---

## Porównanie

| Kryterium | Rozw. 1 (shipment_id w order_items) | Rozw. 2 (shipment_items) | Rozw. 3 (shipment_batch_items) |
|-----------|-------------------------------------|--------------------------|----------------------------------|
| Złożoność migracji | Niska | Średnia | Średnia |
| Czystość modelu | Średnia | Wysoka | Wysoka |
| Zgodność z istniejącym kodem | Wysoka | Wysoka | Wysoka |
| Historia / raporty | Średnia | Dobra | Bardzo dobra |
| Częściowe quantity | Trudne | Proste | Proste |

---

## Rekomendacja

**Rozwiązanie 2 (shipment_items)** daje najlepszy kompromis:
- Prosty i czytelny model
- Wykorzystuje istniejącą tabelę `shipments`
- Umożliwia śledzenie każdej tury
- Nie wymaga zmian w `order_items`
- Daje miejsce na przyszłe rozszerzenia (np. quantity per shipment)

Rozwiązanie 1 jest dobrym wyborem, jeśli priorytetem jest minimalna zmiana schematu.

---

## Następne kroki po wyborze rozwiązania

1. Migracja SQL (utworzenie tabel/kolumn).
2. Aktualizacja Edge Function `create-shipment` lub nowa `create-partial-shipment`.
3. Modyfikacja modułu Magazyn: przycisk „Częściowo wysłane” tworzy shipment + shipment_items/batch_items.
4. Widok „Zamówienia wysłane” – lista wysyłek z podziałem na tury.
