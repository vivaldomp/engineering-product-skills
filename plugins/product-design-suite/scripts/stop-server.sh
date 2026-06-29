#!/usr/bin/env bash
# Stop the product-design-suite preview server and clean up
# Usage: stop-server.sh [--latest] [--project-dir <path>] [<session_dir>]
#
# Kills the server process. Only deletes session directory if it's
# under /tmp (ephemeral). Persistent directories (.product/preview/) are
# kept so mockups can be reviewed later.

# Resolve the session dir. Accepts an explicit positional <session_dir> (back-compat),
# or --latest / no args to pick the newest session under a search root (006 H2).
PROJECT_DIR=""
SESSION_DIR=""
WANT_LATEST="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --latest)      WANT_LATEST="true"; shift ;;
    *)             SESSION_DIR="$1"; shift ;;
  esac
done

resolve_latest() {
  local root="$1" d mt newest="" newest_mt=0
  shopt -s nullglob
  local candidates=()
  if [[ -n "$root" ]]; then candidates=("$root"/.product/preview/*/); else candidates=(/tmp/pds-preview-*/); fi
  for d in "${candidates[@]}"; do
    d="${d%/}"
    [[ -f "$d/state/server.pid" ]] || continue
    mt="$(stat -c %Y "$d/state/server.pid" 2>/dev/null || stat -f %m "$d/state/server.pid" 2>/dev/null || echo 0)"
    if (( mt >= newest_mt )); then newest_mt="$mt"; newest="$d"; fi
  done
  printf '%s\n' "$newest"
}

if [[ -z "$SESSION_DIR" || "$WANT_LATEST" == "true" ]]; then
  SESSION_DIR="$(resolve_latest "$PROJECT_DIR")"
  if [[ -z "$SESSION_DIR" ]]; then
    echo '{"status": "not_running", "note": "no session found"}'
    exit 0
  fi
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"
SERVER_ID_FILE="${STATE_DIR}/server-instance-id"

mark_stopped() {
  local reason="$1"
  rm -f "${STATE_DIR}/server-info"
  printf '{"reason":"%s","timestamp":%s}\n' "$reason" "$(date +%s)" > "${STATE_DIR}/server-stopped"
}

read_expected_server_id() {
  [[ -f "$SERVER_ID_FILE" ]] || return 1
  local id
  id="$(tr -d '\r\n' < "$SERVER_ID_FILE" 2>/dev/null || true)"
  [[ "$id" =~ ^[A-Za-z0-9_-]{32,64}$ ]] || return 1
  printf '%s\n' "$id"
}

command_line_for_pid() {
  local pid="$1"
  if [[ -r "/proc/$pid/cmdline" ]]; then
    tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null || true
    return 0
  fi
  ps -ww -p "$pid" -o command= 2>/dev/null || ps -f -p "$pid" 2>/dev/null | sed '1d' || true
}

command_has_server_id() {
  local pid="$1"
  local expected="$2"
  local expected_arg="--pds-server-id=$expected"
  if [[ -r "/proc/$pid/cmdline" ]]; then
    local arg
    while IFS= read -r -d '' arg || [[ -n "$arg" ]]; do
      [[ "$arg" == "$expected_arg" ]] && return 0
    done < "/proc/$pid/cmdline"
    return 1
  fi
  local command_line
  command_line="$(command_line_for_pid "$pid")"
  [[ -n "$command_line" ]] || return 1
  case " $command_line " in
    *" $expected_arg "*) return 0 ;;
    *) return 1 ;;
  esac
}

# Confirm a PID has this session's per-start instance id, not just a familiar
# process name. Ambiguous or legacy metadata fails closed as stale_pid.
is_pds_server() {
  kill -0 "$1" 2>/dev/null || return 1
  local expected_id
  expected_id="$(read_expected_server_id)" || return 1
  command_has_server_id "$1" "$expected_id" || return 1
  return 0
}

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  # Refuse to signal a PID we can't prove is our server. A stale pid file may
  # point at an unrelated process after a reboot/PID wraparound.
  if ! is_pds_server "$pid"; then
    rm -f "$PID_FILE" "$SERVER_ID_FILE"
    mark_stopped "stale_pid"
    echo '{"status": "stale_pid"}'
    exit 0
  fi

  # Try to stop gracefully, fallback to force if still alive
  kill "$pid" 2>/dev/null || true

  # Wait for graceful shutdown (up to ~2s)
  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # If still running, escalate to SIGKILL
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true

    # Give SIGKILL a moment to take effect
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "process still running"}'
    exit 1
  fi

  rm -f "$PID_FILE" "$SERVER_ID_FILE" "${STATE_DIR}/server.log"
  mark_stopped "stop-server.sh"

  # Only delete ephemeral /tmp directories
  if [[ "$SESSION_DIR" == /tmp/* ]]; then
    rm -rf "$SESSION_DIR"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi
