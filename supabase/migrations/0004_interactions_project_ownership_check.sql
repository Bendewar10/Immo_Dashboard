-- PROJ-12 BUG-2 fix: interactions.project_id must belong to the inserting/updating user,
-- consistent with the ownership check already enforced on project_participants_insert_own.

drop policy if exists "interactions_insert_own" on interactions;
create policy "interactions_insert_own" on interactions for insert with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  )
);

drop policy if exists "interactions_update_own" on interactions;
create policy "interactions_update_own" on interactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
    )
  );
