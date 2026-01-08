# Uruchomienie migracji dla polish_product_name

## Problem
Błąd: `column order_items.polish_product_name does not exist`

## Rozwiązanie
Musisz uruchomić migrację w Supabase, aby dodać kolumnę `polish_product_name` do tabeli `order_items`.

## Instrukcje

### Opcja 1: Przez Supabase Dashboard (Zalecane)

1. Zaloguj się do [Supabase Dashboard](https://app.supabase.com)
2. Wybierz swój projekt
3. Przejdź do **SQL Editor** (w lewym menu)
4. Kliknij **New Query**
5. Skopiuj i wklej poniższy kod SQL:

```sql
-- Add polish_product_name field to order_items table
-- This stores the Polish product name for warehouse use, while product_name remains the client's original entry

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS polish_product_name TEXT;

COMMENT ON COLUMN order_items.polish_product_name IS 'Polish product name for warehouse use, can be set by procurement staff';
```

6. Kliknij **Run** (lub naciśnij Ctrl+Enter)
7. Sprawdź, czy migracja zakończyła się sukcesem

### Opcja 2: Przez Supabase CLI

Jeśli masz zainstalowany Supabase CLI:

```bash
supabase db push
```

Lub bezpośrednio:

```bash
supabase migration up
```

## Weryfikacja

Po uruchomieniu migracji:
1. Odśwież stronę w przeglądarce
2. Kliknij "Szczegóły" w module Zaopatrzenie
3. Błąd powinien zniknąć

## Uwaga

Aplikacja została zaktualizowana, aby obsługiwać przypadek, gdy kolumna nie istnieje (będzie działać bez polskiej nazwy produktu), ale pełna funkcjonalność wymaga uruchomienia migracji.
