-- Ensure all application-user timestamps are valid and have database defaults.
-- Hibernate now also fills these fields through @PrePersist/@PreUpdate.

update app_users
set created_at = current_timestamp
where created_at is null;

update app_users
set updated_at = coalesce(created_at, current_timestamp)
where updated_at is null;

alter table app_users
  alter column created_at set default current_timestamp,
  alter column updated_at set default current_timestamp;

alter table app_users
  alter column created_at set not null,
  alter column updated_at set not null;
