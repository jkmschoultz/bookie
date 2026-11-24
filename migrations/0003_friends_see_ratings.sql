-- Friends may now see a book's rating and reading dates; notes stay private. books.data is what friends are sent and
-- private_data the rest (see FRIEND_FIELDS and PRIVATE_FIELDS in shared/books.ts), so for books already synced the
-- rating and dates move across, and friends see them without waiting for each book to change. Only rows that still keep
-- a rating privately change: not tombstones (which hold nothing) or books synced from now on, which are split this way
-- already. So running this again changes nothing.
UPDATE books
SET data = json_set(
      data,
      '$.rating', json_extract(private_data, '$.rating'),
      '$.dateStarted', json_extract(private_data, '$.dateStarted'),
      '$.dateFinished', json_extract(private_data, '$.dateFinished')
    ),
    private_data = json_remove(private_data, '$.rating', '$.dateStarted', '$.dateFinished')
WHERE json_type(private_data, '$.rating') IS NOT NULL;
