import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";
import {
  listLeads,
  getLeadEvents,
  updateLead,
  setLeadStage,
  setLeadStatus,
  setLeadOwner,
  setLeadFollowUp,
  addLeadNote,
} from "../api/leads.js";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  pickLeadValue,
  prettySource,
} from "../features/leads/lead-utils.js";
import { getAppSessionContext } from "../lib/appSession.js";

export function useLeadsData({ requestedLeadId = "", navigate }) {
  const selectedLeadRef = useRef(null);

  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dbDisabled, setDbDisabled] = useState(false);
  const [error, setError] = useState("");
  const [wsState, setWsState] = useState("idle");

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [savingField, setSavingField] = useState("");
  const [noteText, setNoteText] = useState("");
  const [form, setForm] = useState({
    stage: "new",
    status: "open",
    owner: "",
    priority: "normal",
    valueAzn: "",
    followUpAt: "",
    nextAction: "",
  });
  const [sessionContext, setSessionContext] = useState({
    tenantKey: "",
    actorName: "operator",
  });

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setSessionContext({
          tenantKey: String(next?.tenantKey || "").trim().toLowerCase(),
          actorName: String(next?.actorName || "operator").trim() || "operator",
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const actorName = sessionContext.actorName || "operator";

  const loadLeadsData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (sessionContext.tenantKey) {
        params.tenantKey = sessionContext.tenantKey;
      }

      const j = await listLeads(params);
      const arr = Array.isArray(j?.leads) ? j.leads : [];

      setLeads(arr);
      setDbDisabled(Boolean(j?.dbDisabled));

      if (arr.length > 0) {
        setSelectedLead((prev) => {
          if (requestedLeadId) {
            const fromNav = arr.find((x) => x.id === requestedLeadId);
            if (fromNav) return fromNav;
          }

          if (prev && arr.some((x) => x.id === prev.id)) {
            return arr.find((x) => x.id === prev.id) || arr[0];
          }

          return arr[0];
        });
      } else {
        setSelectedLead(null);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [requestedLeadId, sessionContext.tenantKey]);

  const loadEventsData = useCallback(async (leadId) => {
    if (!leadId) {
      setEvents([]);
      return;
    }

    try {
      setEventsLoading(true);
      const j = await getLeadEvents(leadId, 50);
      setEvents(Array.isArray(j?.events) ? j.events : []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  function patchLeadInState(lead) {
    if (!lead?.id) return;

    setLeads((prev) => {
      const exists = prev.some((x) => x.id === lead.id);
      if (!exists) return [lead, ...prev];
      return prev.map((x) => (x.id === lead.id ? { ...x, ...lead } : x));
    });

    setSelectedLead((prev) => {
      if (prev && prev.id === lead.id) return { ...prev, ...lead };
      return prev;
    });
  }

  useEffect(() => {
    loadLeadsData();
  }, [loadLeadsData]);

  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  useEffect(() => {
    if (!requestedLeadId || !Array.isArray(leads) || !leads.length) return;
    const found = leads.find((x) => String(x?.id || "") === requestedLeadId);
    if (found) setSelectedLead(found);
  }, [requestedLeadId, leads]);

  const selectedLeadId = String(selectedLead?.id || "");

  const selectedLeadFormSnapshot = useMemo(
    () => ({
      stage: String(selectedLead?.stage || "new").toLowerCase(),
      status: String(selectedLead?.status || "open").toLowerCase(),
      owner: String(selectedLead?.owner || ""),
      priority: String(selectedLead?.priority || "normal").toLowerCase(),
      valueAzn:
        selectedLead?.value_azn !== undefined && selectedLead?.value_azn !== null
          ? String(Number(selectedLead.value_azn || 0))
          : "",
      followUpAt: toDatetimeLocalValue(selectedLead?.follow_up_at),
      nextAction: String(selectedLead?.next_action || ""),
    }),
    [
      selectedLead?.stage,
      selectedLead?.status,
      selectedLead?.owner,
      selectedLead?.priority,
      selectedLead?.value_azn,
      selectedLead?.follow_up_at,
      selectedLead?.next_action,
    ]
  );

  useEffect(() => {
    setForm(selectedLeadFormSnapshot);
    setNoteText("");
    loadEventsData(selectedLeadId);
  }, [loadEventsData, selectedLeadFormSnapshot, selectedLeadId]);

  useEffect(() => {
    const unsubscribeStatus = realtimeStore.subscribeStatus((status) => {
      setWsState(String(status?.state || "idle"));
    });

    const unsubscribeEvents = realtimeStore.subscribeEvents(({ type, payload }) => {
      if (!type) return;

      if (type === "lead.created" || type === "lead.updated") {
        const lead = payload?.lead;
        if (!lead?.id) return;
        patchLeadInState(lead);
        return;
      }

      if (type === "lead.event.created") {
        const ev = payload?.event;
        const currentSelectedLead = selectedLeadRef.current;
        if (!ev?.id || !currentSelectedLead?.id) return;
        if (String(ev?.lead_id || "") !== String(currentSelectedLead.id)) return;
        setEvents((prev) => [ev, ...prev]);
      }
    });

    if (!realtimeStore.canUseWs()) setWsState("off");

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, []);

  const filteredLeads = useMemo(() => {
    if (stageFilter === "all") return leads;
    return leads.filter(
      (lead) => String(lead?.stage || "new").toLowerCase() === stageFilter
    );
  }, [leads, stageFilter]);

  const stats = useMemo(() => {
    let qualified = 0;
    let won = 0;
    let open = 0;
    let pipelineValue = 0;

    for (const lead of leads) {
      const stage = String(lead?.stage || "new").toLowerCase();
      const status = String(lead?.status || "open").toLowerCase();

      if (stage === "qualified") qualified += 1;
      if (stage === "won") won += 1;
      if (status === "open") open += 1;

      pipelineValue += pickLeadValue(lead);
    }

    return {
      total: leads.length,
      qualified,
      won,
      open,
      pipelineValue,
    };
  }, [leads]);

  const sourceMix = useMemo(() => {
    const counts = {
      "Instagram DM": 0,
      WhatsApp: 0,
      Facebook: 0,
      Other: 0,
    };

    for (const lead of leads) {
      const src = prettySource(lead);
      if (src === "Instagram DM") counts["Instagram DM"] += 1;
      else if (src === "WhatsApp") counts["WhatsApp"] += 1;
      else if (src === "Facebook") counts["Facebook"] += 1;
      else counts["Other"] += 1;
    }

    const total = Math.max(leads.length, 1);

    return Object.entries(counts).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [leads]);

  const stageMix = useMemo(() => {
    const counts = {
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    };

    for (const lead of leads) {
      const stage = String(lead?.stage || "new").toLowerCase();
      if (counts[stage] !== undefined) counts[stage] += 1;
    }

    return counts;
  }, [leads]);

  async function saveStage(value) {
    if (!selectedLead?.id) return;
    try {
      setSavingField("stage");
      const j = await setLeadStage(selectedLead.id, value, actorName);
      patchLeadInState(j?.lead);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function saveStatus(value) {
    if (!selectedLead?.id) return;
    try {
      setSavingField("status");
      const j = await setLeadStatus(selectedLead.id, value, actorName);
      patchLeadInState(j?.lead);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function saveOwner() {
    if (!selectedLead?.id) return;
    try {
      setSavingField("owner");
      const j = await setLeadOwner(selectedLead.id, form.owner, actorName);
      patchLeadInState(j?.lead);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function saveCoreFields() {
    if (!selectedLead?.id) return;
    try {
      setSavingField("core");
      const j = await updateLead(selectedLead.id, {
        priority: form.priority,
        valueAzn: Number(form.valueAzn || 0),
      });
      patchLeadInState(j?.lead);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function saveFollowUp() {
    if (!selectedLead?.id) return;
    try {
      setSavingField("followup");
      const j = await setLeadFollowUp(selectedLead.id, {
        followUpAt: fromDatetimeLocalValue(form.followUpAt),
        nextAction: form.nextAction,
        actor: actorName,
      });
      patchLeadInState(j?.lead);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function saveNote() {
    if (!selectedLead?.id || !noteText.trim()) return;
    try {
      setSavingField("note");
      const j = await addLeadNote(selectedLead.id, noteText.trim(), actorName);
      patchLeadInState(j?.lead);
      setNoteText("");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingField("");
    }
  }

  async function quickSetStage(stage) {
    setForm((prev) => ({ ...prev, stage }));
    await saveStage(stage);
  }

  function openInboxThread() {
    if (!selectedLead?.inbox_thread_id) return;
    const threadId = String(selectedLead.inbox_thread_id).trim();
    navigate(`/inbox?threadId=${encodeURIComponent(threadId)}`, {
      state: {
        selectedThreadId: threadId,
      },
    });
  }

  return {
    leads,
    selectedLead,
    setSelectedLead,
    stageFilter,
    setStageFilter,
    loading,
    dbDisabled,
    error,
    wsState,
    events,
    eventsLoading,
    savingField,
    noteText,
    setNoteText,
    form,
    setForm,
    filteredLeads,
    stats,
    sourceMix,
    stageMix,
    loadLeadsData,
    saveStage,
    saveStatus,
    saveOwner,
    saveCoreFields,
    saveFollowUp,
    saveNote,
    quickSetStage,
    openInboxThread,
  };
}