-- Атомарный пересчёт агрегатов по ставкам команды и обновление teams (вызывается из API через rpc).
-- Применить в Supabase: SQL Editor → Run, или supabase db push.

CREATE OR REPLACE FUNCTION public.recalculate_team_stats(p_team_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_wins bigint;
  v_pushes bigint;
  v_win_rate numeric;
  v_over_hit_rate numeric;
  v_selected boolean;
  v_denominator bigint;
  v_min_bets constant integer := 10;
  v_min_win_rate constant numeric := 0.60;
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END), 0)::bigint
  INTO v_total, v_wins, v_pushes
  FROM bets
  WHERE team_id = p_team_id AND result IS NOT NULL;

  v_denominator := v_total - v_pushes;
  IF v_denominator > 0 THEN
    v_win_rate := ROUND((v_wins::numeric / v_denominator::numeric), 2);
  ELSE
    v_win_rate := NULL;
  END IF;

  IF v_total > 0 THEN
    v_over_hit_rate := ROUND((v_wins::numeric / v_total::numeric), 2);
  ELSE
    v_over_hit_rate := 0;
  END IF;

  v_selected :=
    v_total >= v_min_bets
    AND v_win_rate IS NOT NULL
    AND v_win_rate >= v_min_win_rate;

  UPDATE teams
  SET
    bets_count = v_total,
    win_rate = v_win_rate,
    over_hit_rate = v_over_hit_rate,
    selected_for_system = v_selected,
    updated_at = now()
  WHERE id = p_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_team_stats(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.recalculate_team_stats(bigint) TO authenticated;
