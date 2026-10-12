import React, { useState, useEffect, useCallback } from "react";
import tournamentService from "../services/tournamentService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import operationsService from "../services/operationsService";
import teamService from "../services/teamService";
import scheduleService from "../services/scheduleService";
import venueService from "../services/venueService";
import LocationMapPicker from "../components/LocationMapPicker";
import { Link } from "react-router-dom";

const divisionPresets = {
  custom: { name: "", min_age: "", max_age: "" },
  "12u": { name: "12 Under", min_age: "", max_age: 12 },
  "14u": { name: "14 Under", min_age: "", max_age: 14 },
  "16u": { name: "16 Under", min_age: "", max_age: 16 },
  "18u": { name: "18 Under", min_age: "", max_age: 18 },
  junior: { name: "Junior Category", min_age: 13, max_age: 21 },
  senior: { name: "Senior Category", min_age: 25, max_age: "" },
  open: { name: "Open Age", min_age: "", max_age: "" },
};

const courtWeekdays = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const ageRangeLabel = (division) => {
  if (division.min_age === null && division.max_age === null) return "Open age · no age restriction";
  if (division.min_age === null) return `Age ${division.max_age} and below`;
  if (division.max_age === null) return `Age ${division.min_age} and above`;
  return `Ages ${division.min_age}–${division.max_age}`;
};

const photonAddress = (properties = {}) => {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  return [...new Set([
    properties.name,
    street,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter(Boolean))].join(", ");
};

const TournamentManagement = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [courtSelectionError, setCourtSelectionError] = useState("");
  const [submittingTournament, setSubmittingTournament] = useState(false);
  const [previewVenueId, setPreviewVenueId] = useState("");
  const [previewCourtId, setPreviewCourtId] = useState("");
  const [venueSearch, setVenueSearch] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSearchBusy, setLocationSearchBusy] = useState(false);
  const [selectedMapPlace, setSelectedMapPlace] = useState(null);
  const [showVenueMapPicker, setShowVenueMapPicker] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [venueDraftMsg, setVenueDraftMsg] = useState("");
  const [venueDraft, setVenueDraft] = useState({ name: "", location: "" });
  const [joinTournament, setJoinTournament] = useState(null);
  const [joinLogo, setJoinLogo] = useState(null);
  const [joinForm, setJoinForm] = useState({ team_name: '', short_name: '', primary_color: 'red' });
  const [msg, setMsg] = useState("");
  const [divisionTournament, setDivisionTournament] = useState(null);
  const [detailTournament, setDetailTournament] = useState(null);
  const [detailData, setDetailData] = useState({ divisions: [], teams: [], matches: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [divisionForm, setDivisionForm] = useState({
    name: "",
    age_group: "",
    min_age: "",
    max_age: "",
    age_cutoff_date: "",
    gender_category: "open",
    format: "round_robin",
    max_roster_size: 15,
    eligibility_requirements: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    sport_id: "",
    format: "single_elimination",
    start_date: "",
    end_date: "",
    registration_fee: 0,
    rules: "",
    description: "",
    status: "upcoming",
    court_ids: [],
    schedule_start_time: "08:00",
    schedule_end_time: "20:00",
    default_match_duration_minutes: 90,
    default_break_minutes: 15,
    min_rest_minutes_between_games: 120,
    max_games_per_team_per_day: 2,
    available_days: courtWeekdays.map(([value]) => value),
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, venueRes] = await Promise.all([
        tournamentService.getTournaments(),
        venueService.getVenues().catch(() => ({ venues: [] })),
      ]);
      setTournaments(res.tournaments || []);
      setVenues((venueRes.venues || []).filter((venue) => !["rejected", "suspended"].includes(venue.approval_status)));
      const basketballSports = (res.sports || []).filter(
        (s) => s.name.toLowerCase() === "basketball",
      );
      if (basketballSports.length > 0) {
        setFormData((prev) => prev.sport_id ? prev : ({ ...prev, sport_id: basketballSports[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const query = venueSearch.trim();
    if (query.length < 3 || selectedMapPlace?.label === query) {
      setLocationSuggestions([]);
      setLocationSearchBusy(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLocationSearchBusy(true);
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", query);
        url.searchParams.set("limit", "6");
        url.searchParams.set("lat", "11.005");
        url.searchParams.set("lon", "124.607");
        url.searchParams.set("lang", "en");
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Location search unavailable");
        const payload = await response.json();
        setLocationSuggestions((payload.features || []).map((feature) => ({
          label: photonAddress(feature.properties),
          name: feature.properties?.name || "",
          coordinates: feature.geometry?.coordinates || [],
        })).filter((item) => item.label));
      } catch (error) {
        if (error.name !== "AbortError") setLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLocationSearchBusy(false);
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [venueSearch, selectedMapPlace]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.court_ids.length) {
      setCourtSelectionError("Choose at least one approved court for this tournament.");
      return;
    }
    if (!availabilitySaved) {
      setCourtSelectionError("Save the court availability before submitting the tournament.");
      return;
    }
    try {
      setSubmittingTournament(true);
      await tournamentService.createTournament(formData);
      setMsg("Tournament saved and published. Coaches can now view the competition.");
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || (err.code === "ECONNABORTED" ? "The database is taking too long to respond. Please try again." : "Could not submit the tournament. Check your connection and try again."));
    } finally {
      setSubmittingTournament(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this tournament?")) return;
    try {
      await tournamentService.deleteTournament(id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting tournament");
    }
  };

  const handleReview = async (tournament, status) => {
    let notes = '';
    if (status === 'rejected') {
      const reason = window.prompt('Add a short reason for rejecting this tournament application:');
      if (reason === null) return;
      notes = reason.trim();
      if (!notes) {
        alert('Please enter a reason so the organizer knows what to fix.');
        return;
      }
    } else if (!window.confirm(`Approve and publish “${tournament.name}”? Teams will be able to view and apply.`)) {
      return;
    }
    try {
      setReviewingId(tournament.id);
      await tournamentService.reviewTournament(tournament.id, status, notes);
      setMsg(status === 'approved' ? 'Tournament approved and published.' : 'Tournament rejected. The organizer can review the decision.');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to save the tournament decision. Refresh and try again.');
    } finally {
      setReviewingId(null);
    }
  };

  const submitTeamApplication = async (event) => {
    event.preventDefault();
    try {
      const response=await teamService.registerTeam({...joinForm,tournament_id:joinTournament.id});
      const teamId=response?.data?.team_id;
      if (joinLogo && teamId) await teamService.uploadLogo(teamId,joinLogo);
      setMsg('Team application submitted. Wait for the organizer to approve your team.');
      setJoinTournament(null);
      setJoinLogo(null);
      setJoinForm({team_name:'',short_name:'',primary_color:'red'});
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to submit the team application.');
    }
  };

  const applicationLabel=(status)=>status==='draft'?'Application Pending':status==='registered'?'Team Approved':status==='disqualified'?'Application Rejected':'Join Tournament';

  const openDivisions = async (tournament) => {
    setDivisionTournament(tournament);
    setDivisions(await operationsService.divisions(tournament.id));
  };
  const openDetails = async (tournament) => {
    setDetailTournament(tournament);
    setDetailLoading(true);
    try {
      const [divisionRows, teamRows, matchRows] = await Promise.all([
        operationsService.divisions(tournament.id).catch(()=>[]),
        teamService.getTeams().catch(()=>[]),
        scheduleService.getSchedule(tournament.id).catch(()=>[]),
      ]);
      setDetailData({ divisions: divisionRows, teams: teamRows.filter(team=>Number(team.tournament_id)===Number(tournament.id)), matches: matchRows });
    } finally { setDetailLoading(false); }
  };
  const createDivision = async (event) => {
    event.preventDefault();
    try {
      await operationsService.createDivision(divisionTournament.id, divisionForm);
      setDivisions(await operationsService.divisions(divisionTournament.id));
      setDivisionForm({ ...divisionForm, name: "", age_group: "", min_age: "", max_age: "", age_cutoff_date: "", eligibility_requirements: "" });
      setMsg("Division added successfully.");
    } catch (error) {
      setMsg(error.response?.data?.message || "Unable to add the division.");
    }
  };

  const applyDivisionPreset = (presetKey) => {
    const preset = divisionPresets[presetKey];
    if (!preset) return;
    setDivisionForm((current) => ({ ...current, ...preset, age_group: presetKey === "open" ? "Open age" : preset.name }));
  };

  const tournamentStats = {
    total: tournaments.length,
    ongoing: tournaments.filter((t) => t.status === "ongoing").length,
    upcoming: tournaments.filter((t) => t.status === "upcoming").length,
    teams: tournaments.reduce((sum, t) => sum + Number(t.registered_teams_count || 0), 0),
  };
  const canCreateTournaments = ["platform_admin", "admin"].includes(user?.role);
  const canReviewTournaments = false;
  const canViewTournamentOperations = canCreateTournaments || canReviewTournaments;
  const selectedCourtCount = formData.court_ids.length;
  const bookableCourtCount = venues.reduce((count, venue) => count + (venue.courts || []).filter((court) => Boolean(Number(court.is_available))).length, 0);
  const selectedVenueCount = new Set(
    venues.filter((venue) => (venue.courts || []).some((court) => formData.court_ids.includes(String(court.id))))
      .map((venue) => String(venue.id)),
  ).size;
  const normalizedVenueSearch = venueSearch.trim().toLowerCase();
  const filteredVenues = venues.filter((venue) => {
    if (!normalizedVenueSearch) return true;
    return [venue.name, venue.location, ...(venue.courts || []).map((court) => court.court_name)]
      .some((value) => String(value || "").toLowerCase().includes(normalizedVenueSearch));
  });
  const selectedVenue = venues.find((venue) => (venue.courts || []).some((court) => formData.court_ids.includes(String(court.id))));
  const displayedVenues = selectedVenue
    ? filteredVenues.filter((venue) => String(venue.id) === String(selectedVenue.id))
    : filteredVenues;
  const requestedPreviewVenue = venues.find((venue) => String(venue.id) === String(previewVenueId));
  const previewVenue = normalizedVenueSearch
    ? (filteredVenues[0] || null)
    : (requestedPreviewVenue || selectedVenue || filteredVenues[0] || venues[0] || null);
  const previewCourt = (previewVenue?.courts || []).find((court) => String(court.id) === String(previewCourtId))
    || (normalizedVenueSearch ? (previewVenue?.courts || []).find((court) => String(court.court_name || "").toLowerCase().includes(normalizedVenueSearch)) : null)
    || (previewVenue?.courts || []).find((court) => formData.court_ids.includes(String(court.id)))
    || null;
  const mapQuery = previewVenue ? encodeURIComponent(`${previewCourt?.court_name ? `${previewCourt.court_name}, ` : ""}${previewVenue.name}, ${previewVenue.location}`) : "";
  const chooseLocationSuggestion = (place) => {
    setSelectedMapPlace(place);
    setVenueSearch(place.label);
    setLocationSuggestions([]);
    setVenueDraft((current) => ({
      ...current,
      name: current.name || place.name,
      location: place.label,
    }));
    setVenueDraftMsg("Address selected from location search. Confirm the venue details, then attach it.");
  };
  const chooseMapPoint = (place) => {
    setSelectedMapPlace({ label: place.address, name: place.name, coordinates: place.coordinates });
    setVenueSearch(place.address);
    setLocationSuggestions([]);
    setVenueDraft((current) => ({ ...current, name: current.name || place.name, location: place.address }));
    setVenueDraftMsg("Map location selected. Confirm the venue details, then attach it.");
    requestAnimationFrame(() => {
      document.getElementById("new-venue-fields")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("new-venue-name")?.focus({ preventScroll: true });
    });
  };
  const toggleTournamentCourt = (courtId) => {
    const id = String(courtId);
    const parentVenue = venues.find((venue) => (venue.courts || []).some((court) => String(court.id) === id));
    if (parentVenue) setPreviewVenueId(String(parentVenue.id));
    setPreviewCourtId(id);
    setCourtSelectionError("");
    setAvailabilitySaved(false);
    setFormData((current) => ({
      ...current,
      court_ids: current.court_ids.includes(id)
        ? []
        : [id],
    }));
  };
  const toggleAvailableDay = (day) => {
    setAvailabilitySaved(false);
    setFormData((current) => ({
      ...current,
      available_days: current.available_days.includes(day)
        ? current.available_days.filter((value) => value !== day)
        : [...current.available_days, day],
    }));
  };
  const saveCourtAvailability = () => {
    if (!formData.available_days.length) {
      setCourtSelectionError("Select at least one available day for the court.");
      return;
    }
    if (!formData.schedule_start_time || !formData.schedule_end_time || formData.schedule_end_time <= formData.schedule_start_time) {
      setCourtSelectionError("Court closing time must be later than its opening time.");
      return;
    }
    setCourtSelectionError("");
    setAvailabilitySaved(true);
  };
  const toggleVenueCourts = (venue) => {
    const availableIds = (venue.courts || []).filter((court) => Boolean(Number(court.is_available))).map((court) => String(court.id));
    const courtId = availableIds[0] || "";
    const allSelected = courtId && formData.court_ids.includes(courtId);
    setPreviewVenueId(String(venue.id));
    setPreviewCourtId(courtId);
    setCourtSelectionError("");
    setFormData((current) => ({
      ...current,
      court_ids: allSelected ? [] : (courtId ? [courtId] : []),
    }));
  };
  const createBundledVenue = async () => {
    if (!venueDraft.name.trim() || !venueDraft.location.trim()) {
      setVenueDraftMsg("Enter the venue name and complete address.");
      return;
    }
    try {
      setCreatingVenue(true);
      setVenueDraftMsg("");
      const venueResponse = await venueService.createVenue({ name: venueDraft.name.trim(), location: venueDraft.location.trim() });
      const venueId = venueResponse?.data?.id;
      const courtResponse = await venueService.createCourt({ venue_id: venueId, court_name: "Main Court", sport_id: formData.sport_id || null, is_available: true });
      const courtIds = [String(courtResponse?.data?.id)];
      const refreshed = await venueService.getVenues();
      const usableVenues = (refreshed.venues || []).filter((venue) => !["rejected", "suspended"].includes(venue.approval_status));
      const createdVenue = usableVenues.find((venue) => String(venue.id) === String(venueId));
      const refreshedCourtIds = (createdVenue?.courts || []).filter((court) => Boolean(Number(court.is_available))).map((court) => String(court.id));
      const attachedCourtIds = refreshedCourtIds.length ? refreshedCourtIds : courtIds.filter((id) => id && id !== "undefined");
      setVenues(usableVenues);
      setPreviewVenueId(String(venueId));
      setPreviewCourtId(attachedCourtIds[0] || "");
      setFormData((current) => ({ ...current, court_ids: attachedCourtIds.slice(0, 1) }));
      setVenueDraft({ name: "", location: "" });
      setShowVenueMapPicker(false);
      setVenueDraftMsg("Venue created with one Main Court and selected for this tournament.");
    } catch (error) {
      setVenueDraftMsg(error.response?.data?.message || "Could not add this venue. Try again.");
    } finally {
      setCreatingVenue(false);
    }
  };
  const editVenueFromPicker = async (venue) => {
    const name = window.prompt("Edit venue name", venue.name || "");
    if (name === null) return;
    const location = window.prompt("Edit complete address", venue.location || "");
    if (location === null) return;
    if (!name.trim() || !location.trim()) {
      setVenueDraftMsg("Venue name and complete address cannot be empty.");
      return;
    }
    try {
      setVenueDraftMsg("");
      await venueService.updateVenue(venue.id, { name: name.trim(), location: location.trim() });
      setVenues((current) => current.map((item) => String(item.id) === String(venue.id)
        ? { ...item, name: name.trim(), location: location.trim() }
        : item));
      setVenueDraftMsg("Venue details updated.");
    } catch (error) {
      setVenueDraftMsg(error.response?.data?.message || "Could not update this venue. Try again.");
    }
  };
  const deleteVenueFromPicker = async (venue) => {
    if (!window.confirm(`Delete ${venue.name}? Its Main Court will also be removed.`)) return;
    const venueCourtIds = (venue.courts || []).map((court) => String(court.id));
    try {
      setVenueDraftMsg("");
      await venueService.deleteVenue(venue.id);
      setVenues((current) => current.filter((item) => String(item.id) !== String(venue.id)));
      setFormData((current) => ({
        ...current,
        court_ids: current.court_ids.filter((id) => !venueCourtIds.includes(String(id))),
      }));
      if (String(previewVenueId) === String(venue.id)) {
        setPreviewVenueId("");
        setPreviewCourtId("");
      }
      setAvailabilitySaved(false);
      setVenueDraftMsg("Venue and its Main Court deleted.");
    } catch (error) {
      setVenueDraftMsg(error.response?.data?.message || "Could not delete this venue. It may already be used by a tournament.");
    }
  };

  return (
    <div className="container-fluid p-0 tournament-operations-page">
      <section className="tournament-ops-hero">
        <div className="tournament-ops-copy">
          <span className="tournament-ops-eyebrow"><i className="bi bi-dribbble" /> BASKETBALL COMPETITIONS</span>
          <h1>Tournament Operations</h1>
          <p>
            {['coach', 'coach_manager'].includes(user?.role)
              ? 'View competitions, divisions, formats, and registration details'
              : canReviewTournaments
                ? 'Create, publish, and manage official basketball competitions'
                : 'Create and manage your basketball leagues, divisions, and tournament formats'}
          </p>
          <div className="tournament-ops-meta"><span><i className="bi bi-trophy" /> One place for every competition</span><span><i className="bi bi-shield-check" /> Organized tournament details</span></div>
        </div>
        <div className="tournament-ops-hero-side">
          <span className="tournament-ops-emblem"><i className="bi bi-trophy-fill" /></span>
          {canCreateTournaments && <button className="btn btn-evsu tournament-ops-create" onClick={() => { setCourtSelectionError(""); setShowModal(true); }}><i className="bi bi-plus-lg me-1" /> Create Tournament</button>}
        </div>
        <i className="bi bi-dribbble tournament-ops-watermark" aria-hidden="true" />
      </section>

      {!loading && <section className="tournament-ops-summary" aria-label="Tournament summary">
        <div><span className="tournament-ops-stat-icon"><i className="bi bi-trophy" /></span><span><b>{tournamentStats.total}</b><small>Total tournaments</small></span></div>
        <div><span className="tournament-ops-stat-icon is-live"><i className="bi bi-broadcast" /></span><span><b>{tournamentStats.ongoing}</b><small>Live competitions</small></span></div>
        <div><span className="tournament-ops-stat-icon is-upcoming"><i className="bi bi-calendar-event" /></span><span><b>{tournamentStats.upcoming}</b><small>Upcoming</small></span></div>
        <div><span className="tournament-ops-stat-icon is-teams"><i className="bi bi-people" /></span><span><b>{tournamentStats.teams}</b><small>Registered teams</small></span></div>
      </section>}

      {msg && (
        <div className="alert alert-success py-2 px-3 small rounded-3 mb-3">
          {msg}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading tournaments..." />
      ) : (
        <>
        <div className="tournament-ops-list-heading"><div><span>COMPETITION DIRECTORY</span><h2>{['coach', 'coach_manager'].includes(user?.role) ? 'Upcoming tournaments' : 'Official tournaments'}</h2></div><small>{tournaments.length} {tournaments.length === 1 ? 'tournament' : 'tournaments'}</small></div>
        {tournaments.length ? <div className="row g-3 tournament-ops-grid">
          {tournaments.map((t) => (
            <div key={t.id} className="col-12 col-md-6 col-xl-4">
              <div className="card-custom tournament-ops-card p-4 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="tournament-ops-card-top">
                    <span className="tournament-ops-sport"><i className="bi bi-dribbble" /> BASKETBALL</span>
                    <span className={`tournament-ops-status ${t.status === 'ongoing' ? 'is-live' : t.status === 'completed' ? 'is-complete' : 'is-upcoming'}`}><i className="bi bi-circle-fill" /> {t.status || 'upcoming'}</span>
                  </div>
                  <h3 className="tournament-ops-card-title">{t.name}</h3>
                  <p className="tournament-ops-card-description">
                    {t.description || "No description provided."}
                  </p>

                  <div className="tournament-ops-facts">
                    <div><span><i className="bi bi-diagram-3" /> Format</span><b>{String(t.format || 'Not set').replaceAll('_', ' ')}</b></div>
                    <div><span><i className="bi bi-calendar2-range" /> Dates</span><b>{t.start_date || 'TBD'} <em>to</em> {t.end_date || 'TBD'}</b></div>
                    <div><span><i className="bi bi-cash-stack" /> Entry fee</span><b className="fee">₱{Number(t.registration_fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                    <div><span><i className="bi bi-people" /> Teams</span><b>{Number(t.registered_teams_count || 0)} registered</b></div>
                  </div>
                </div>

                {canViewTournamentOperations && (
                  <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2 flex-wrap">
                    <button className="btn btn-evsu btn-sm" onClick={()=>openDetails(t)}><i className="bi bi-eye me-1"/>View Tournament</button>
                    {canCreateTournaments && <button
                      className="btn btn-outline-dark btn-sm"
                      onClick={() => openDivisions(t)}
                    >
                      <i className="bi bi-layers me-1" />
                      Divisions
                    </button>}
                    {canCreateTournaments && <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDelete(t.id)}
                    >
                      <i className="bi bi-trash"></i> Delete
                    </button>}
                    {canReviewTournaments && t.approval_status === 'pending' && <>
                      <button className="btn btn-success btn-sm" disabled={reviewingId === t.id} onClick={() => handleReview(t, 'approved')}><i className="bi bi-check-lg me-1"/>{reviewingId === t.id ? 'Saving…' : 'Approve & publish'}</button>
                      <button className="btn btn-outline-danger btn-sm" disabled={reviewingId === t.id} onClick={() => handleReview(t, 'rejected')}><i className="bi bi-x-lg me-1"/>Reject</button>
                    </>}
                  </div>
                )}
                {['coach','coach_manager'].includes(user?.role)&&<div className="mt-4 pt-3 border-top">
                  {t.application_team_id ? <>
                    <div className={`alert py-2 px-3 small mb-2 ${t.application_status==='registered'?'alert-success':t.application_status==='disqualified'?'alert-danger':'alert-warning'}`}>
                      <i className={`bi me-2 ${t.application_status==='registered'?'bi-check-circle-fill':t.application_status==='disqualified'?'bi-x-circle-fill':'bi-hourglass-split'}`}/>
                      <b>{applicationLabel(t.application_status)}</b>{t.application_team_name ? ` · ${t.application_team_name}` : ''}
                    </div>
                    <label className="tournament-location-search">
                      <i className="bi bi-search" aria-hidden="true"/>
                      <input type="search" value={venueSearch} onChange={(event) => setVenueSearch(event.target.value)} placeholder="Search venue, court, or address" aria-label="Search venue, court, or address"/>
                      {venueSearch && <button type="button" onClick={() => setVenueSearch("")} aria-label="Clear location search"><i className="bi bi-x-lg"/></button>}
                    </label>
                    {t.application_status==='registered'&&<button className="btn btn-evsu btn-sm w-100" onClick={()=>openDetails(t)}><i className="bi bi-eye me-1"/>View Tournament</button>}
                  </> : <button className="btn btn-evsu btn-sm w-100" onClick={()=>setJoinTournament(t)}><i className="bi bi-box-arrow-in-right me-1"/>Join Tournament</button>}
                </div>}
              </div>
            </div>
          ))}
        </div> : <div className="tournament-ops-empty"><span><i className="bi bi-trophy" /></span><h3>No tournaments yet</h3><p>{canCreateTournaments ? 'Create the first official tournament. It becomes visible immediately.' : 'There are no upcoming competitions yet.'}</p>{canCreateTournaments && <button className="btn btn-evsu" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg me-1" /> Create first tournament</button>}</div>}
        </>
      )}

      {/* Create Modal */}
      {joinTournament&&<div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,.72)'}} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content card-custom border-0 overflow-hidden">
          <div className="modal-header border-bottom"><div><small className="text-danger fw-bold">TEAM APPLICATION</small><h5 className="fw-bold mb-0">Join {joinTournament.name}</h5></div><button className="btn-close" onClick={()=>setJoinTournament(null)} aria-label="Close"/></div>
          <form onSubmit={submitTeamApplication}><div className="modal-body">
            <div className="alert alert-light border small"><i className="bi bi-info-circle-fill text-danger me-2"/>Submit your team first. After approval, complete your roster, player eligibility, and payment requirements.</div>
            <div className="mb-3"><label className="form-label small fw-semibold">Team Name</label><input required className="form-control" value={joinForm.team_name} onChange={e=>setJoinForm({...joinForm,team_name:e.target.value})} placeholder="e.g. Barangay Cogon Ballers"/></div>
            <div className="mb-3"><label className="form-label small fw-semibold">Team Short Name</label><input required maxLength="20" className="form-control" value={joinForm.short_name} onChange={e=>setJoinForm({...joinForm,short_name:e.target.value})} placeholder="e.g. COGON"/></div>
            <div className="mb-3"><label className="form-label small fw-semibold">Jersey Color</label><div className="d-flex gap-2 align-items-center"><span className="rounded-circle border" style={{width:34,height:34,background:joinForm.primary_color}}/><input required className="form-control" list="application-colors" value={joinForm.primary_color} onChange={e=>setJoinForm({...joinForm,primary_color:e.target.value})}/><datalist id="application-colors"><option value="red"/><option value="blue"/><option value="black"/><option value="white"/><option value="green"/><option value="yellow"/><option value="maroon"/><option value="navy"/></datalist></div></div>
            <div><label className="form-label small fw-semibold">Team Logo <span className="text-muted">(optional)</span></label><input type="file" className="form-control" accept="image/jpeg,image/png,image/webp" onChange={e=>setJoinLogo(e.target.files?.[0]||null)}/></div>
          </div><div className="modal-footer border-top"><button type="button" className="btn btn-light" onClick={()=>setJoinTournament(null)}>Cancel</button><button className="btn btn-evsu"><i className="bi bi-send me-1"/>Submit Application</button></div></form>
        </div></div>
      </div>}
      {detailTournament && <div className="modal show d-block tournament-detail-modal" style={{backgroundColor:'rgba(0,0,0,.72)'}} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div className="modal-content card-custom border-0 overflow-hidden">
          <header className="tournament-detail-hero"><button className="btn-close btn-close-white" aria-label="Close" onClick={()=>setDetailTournament(null)}/><span className="tournament-detail-kicker"><i className="bi bi-dribbble"/> FULLCOURT TOURNAMENT</span><h3>{detailTournament.name}</h3><p>{detailTournament.description||'Basketball tournament managed through FullCourt.'}</p><div className="tournament-detail-chips"><span><i className="bi bi-diagram-3"/>{String(detailTournament.format).replaceAll('_',' ')}</span><span><i className="bi bi-calendar-range"/>{detailTournament.start_date} – {detailTournament.end_date}</span><span><i className="bi bi-circle-fill"/>{detailTournament.status}</span></div></header>
          <div className="modal-body tournament-detail-body">
            {detailLoading?<LoadingSpinner message="Loading tournament contents..."/>:<>
              <div className="tournament-detail-stats"><div><i className="bi bi-people-fill"/><strong>{detailData.teams.length}</strong><span>Registered teams</span></div><div><i className="bi bi-layers-fill"/><strong>{detailData.divisions.length}</strong><span>Divisions</span></div><div><i className="bi bi-calendar2-event-fill"/><strong>{detailData.matches.length}</strong><span>Scheduled games</span></div><div><i className="bi bi-cash-stack"/><strong>₱{Number(detailTournament.registration_fee||0).toLocaleString()}</strong><span>Registration fee</span></div></div>
              <div className="row g-4 mt-1"><div className="col-lg-7"><section className="tournament-content-panel"><header><div><small>PARTICIPANTS</small><h5>Registered Teams</h5></div><Link to="/teams">Manage teams <i className="bi bi-arrow-up-right"/></Link></header><div className="tournament-team-grid">{detailData.teams.map(team=><article key={team.id}><span style={{background:team.primary_color||'#cd2d17'}}>{team.logo_url?<img src={team.logo_url} alt=""/>:team.team_name.slice(0,2).toUpperCase()}</span><div><b>{team.team_name}</b><small>{team.division_name||'Open division'} · {team.status}</small></div></article>)}{!detailData.teams.length&&<p className="tournament-detail-empty">No registered teams yet.</p>}</div></section></div><div className="col-lg-5"><section className="tournament-content-panel"><header><div><small>COMPETITION STRUCTURE</small><h5>Divisions</h5></div></header><div className="tournament-division-list">{detailData.divisions.map(division=><div key={division.id}><span><i className="bi bi-layers"/></span><div><b>{division.name}</b><small>{division.age_group||'Open age'} · {division.gender_category} · {division.team_count} teams</small></div></div>)}{!detailData.divisions.length&&<p className="tournament-detail-empty">No divisions created yet.</p>}</div></section></div></div>
            </>}
          </div>
          <footer className="modal-footer">{detailTournament.approval_status === 'approved' && <Link to={`/sports/tournaments/${detailTournament.id}`} className="btn btn-outline-secondary btn-sm" target="_blank"><i className="bi bi-box-arrow-up-right me-1"/>Public tournament page</Link>}<button className="btn btn-light btn-sm" onClick={()=>setDetailTournament(null)}>Close</button></footer>
        </div></div>
      </div>}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable tournament-create-dialog">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <div><h5 className="fw-bold mb-0">Create Official Tournament</h5><small className="text-muted">Saving publishes the tournament immediately for coaches.</small></div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  aria-label="Close create tournament form"
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="tournament-create-step"><span>1</span><div><b>Competition details</b><small>Name the tournament and set its official date range.</small></div></div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Tournament Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g. Barangay Summer Basketball League 2026"
                    />
                  </div>
                  <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Format
                      </label>
                      <select
                        className="form-select"
                        value={formData.format}
                        onChange={(e) =>
                          setFormData({ ...formData, format: e.target.value })
                        }
                      >
                        <option value="single_elimination">
                          Single Elimination
                        </option>
                        <option value="double_elimination">
                          Double Elimination
                        </option>
                        <option value="round_robin">Round Robin</option>
                        <option value="group_stage">Group Stage</option>
                        <option value="league">League</option>
                      </select>
                  </div>
                  <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Tournament Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            start_date: e.target.value,
                            end_date: e.target.value,
                          })
                        }
                      />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Registration Fee (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.registration_fee}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registration_fee: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button type="button" className="tournament-create-step is-action" aria-controls="tournament-location-picker" onClick={() => { const picker = document.getElementById("tournament-location-picker"); picker?.scrollIntoView({ behavior: "smooth", block: "start" }); picker?.focus({ preventScroll: true }); }}><span>2</span><div><b>Game location</b><small>Choose exactly where every game can be played.</small></div><em>Tap to choose <i className="bi bi-chevron-down"/></em></button>
                  <section id="tournament-location-picker" className="tournament-venue-picker" aria-labelledby="tournament-venue-heading" tabIndex="-1">
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div>
                        <label id="tournament-venue-heading" className="form-label small fw-bold mb-1">Game venues &amp; courts <span className="text-danger">*</span></label>
                        <p className="small text-muted mb-0">Choose one venue and its Main Court. Individual games can be moved later in Schedule Optimization.</p>
                      </div>
                      <span className="tournament-venue-count" aria-live="polite">{selectedVenueCount} venues · {selectedCourtCount} courts</span>
                    </div>
                    {bookableCourtCount > 0 && !selectedCourtCount && <button type="button" className="tournament-add-venue-map" onClick={() => setShowVenueMapPicker((current) => !current)}><i className={`bi ${showVenueMapPicker ? "bi-chevron-up" : "bi-map"}`}/><span>{showVenueMapPicker ? "Hide map picker" : "Choose a venue from map"}</span></button>}
                    <div className="tournament-location-autocomplete">
                      <div className="tournament-location-search">
                        <i className={`bi ${locationSearchBusy ? "bi-arrow-repeat location-search-spin" : "bi-search"}`} aria-hidden="true"/>
                        <input id="tournament-map-search" type="search" value={venueSearch} autoComplete="off" aria-autocomplete="list" aria-controls="tournament-location-results" onChange={(event) => { setVenueSearch(event.target.value); setSelectedMapPlace(null); setVenueDraftMsg(""); }} placeholder="Search a venue, court, barangay, or address" aria-label="Search map location"/>
                        {venueSearch && <button type="button" onClick={() => { setVenueSearch(""); setSelectedMapPlace(null); setLocationSuggestions([]); }} aria-label="Clear map search"><i className="bi bi-x-lg"/></button>}
                      </div>
                      {locationSuggestions.length > 0 && <div id="tournament-location-results" className="tournament-location-results" role="listbox">{locationSuggestions.map((place, index) => <button type="button" role="option" key={`${place.label}-${index}`} onClick={() => chooseLocationSuggestion(place)}><i className="bi bi-geo-alt-fill"/><span><b>{place.name || place.label.split(",")[0]}</b><small>{place.label}</small></span><i className="bi bi-arrow-return-left"/></button>)}</div>}
                    </div>
                    <details className="tournament-inline-venue" open>
                      <summary><span><i className="bi bi-plus-circle"/> Add a new game venue</span><small>Managed by Admin</small></summary>
                      <div id="new-venue-fields" className="tournament-inline-venue-fields">
                        <label><span>Venue name</span><input id="new-venue-name" className="form-control" value={venueDraft.name} onChange={(e) => { setVenueDraft({...venueDraft,name:e.target.value}); setVenueDraftMsg(""); }} placeholder="e.g. Ormoc City Sports Complex"/></label>
                        <label><span>Complete address</span><input id="new-venue-address" className="form-control" value={venueDraft.location} onChange={(e) => { setVenueDraft({...venueDraft,location:e.target.value}); setVenueDraftMsg(""); }} placeholder="Street, barangay, city"/></label>
                        <button type="button" className="btn btn-outline-danger" disabled={creatingVenue} onClick={createBundledVenue}>{creatingVenue ? <><span className="spinner-border spinner-border-sm me-1"/>Adding…</> : <><i className="bi bi-plus-lg me-1"/>Attach venue</>}</button>
                      </div>
                      {venueDraftMsg && <div className={`tournament-inline-message ${venueDraftMsg.startsWith("Venue created") || venueDraftMsg.startsWith("Address added") ? "is-success" : ""}`}>{venueDraftMsg}</div>}
                    </details>
                    {bookableCourtCount === 0 ? (
                      <div className="tournament-empty-location-grid">
                        <div className="tournament-venue-empty"><i className="bi bi-info-circle"/><span>No court is attached yet. Search the map, enter the venue details above, then attach it. FullCourt will create its Main Court automatically.</span></div>
                        <LocationMapPicker coordinates={selectedMapPlace?.coordinates} onPick={chooseMapPoint}/>
                      </div>
                    ) : (
                      <div className="tournament-location-workspace"><div className="tournament-venue-list">
                        {displayedVenues.map((venue) => {
                          const availableCourts = (venue.courts || []).filter((court) => Boolean(Number(court.is_available)));
                          const selectedInVenue = availableCourts.filter((court) => formData.court_ids.includes(String(court.id))).length;
                          if (!availableCourts.length) return null;
                          return <article className={`tournament-venue-option ${selectedInVenue ? "is-selected" : ""} ${String(previewVenue?.id) === String(venue.id) ? "is-previewed" : ""}`} key={venue.id} onClick={() => setPreviewVenueId(String(venue.id))}>
                            <div className="tournament-venue-option-head">
                              <div><strong><i className="bi bi-geo-alt-fill"/> {venue.name}</strong><small>{venue.location}</small></div>
                              <div className="tournament-venue-card-actions">
                                <button type="button" className="tournament-venue-icon-action" aria-label={`Edit venue ${venue.name}`} title="Edit venue" onClick={(event) => { event.stopPropagation(); editVenueFromPicker(venue); }}><i className="bi bi-pencil"/></button>
                                <button type="button" className="tournament-venue-icon-action is-danger" aria-label={`Delete venue ${venue.name}`} title="Delete venue" onClick={(event) => { event.stopPropagation(); deleteVenueFromPicker(venue); }}><i className="bi bi-trash3"/></button>
                                <button type="button" className="tournament-select-all" onClick={(event) => { event.stopPropagation(); toggleVenueCourts(venue); }}>{selectedInVenue ? "Clear" : "Use venue"}</button>
                              </div>
                            </div>
                            <div className="tournament-venue-selection-summary">{selectedInVenue ? "Main Court selected" : "Venue not selected"}</div>
                            <div className="tournament-venue-courts">{availableCourts.map((court) => {
                              const checked = formData.court_ids.includes(String(court.id));
                              return <label className={`tournament-court-choice ${checked ? "is-checked" : ""}`} key={court.id} onClick={(event) => event.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={() => toggleTournamentCourt(court.id)} />
                                <i className={`bi ${checked ? "bi-check2-square" : "bi-square"}`} aria-hidden="true" />
                                <span>{court.court_name}</span>
                              </label>;
                            })}</div>
                          </article>;
                        })}
                        {!displayedVenues.length && <div className="tournament-location-no-results"><i className="bi bi-geo-alt"/><b>No matching location</b><span>Try another venue, court, or address.</span></div>}
                      </div>{showVenueMapPicker ? <LocationMapPicker coordinates={selectedMapPlace?.coordinates} onPick={chooseMapPoint}/> : previewVenue && <aside className="tournament-map-preview"><iframe key={mapQuery} title={`Map of ${previewCourt?.court_name || previewVenue.name}`} src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div><span><i className="bi bi-pin-map-fill"/> Google Maps location</span><b>{previewCourt?.court_name || previewVenue.name}</b>{previewCourt && <small className="tournament-map-venue-name">{previewVenue.name}</small>}<small>{previewVenue.location}</small>{previewCourt && <button type="button" className={`tournament-map-select ${formData.court_ids.includes(String(previewCourt.id)) ? "is-selected" : ""}`} onClick={() => toggleTournamentCourt(previewCourt.id)}><i className={`bi ${formData.court_ids.includes(String(previewCourt.id)) ? "bi-check-circle-fill" : "bi-plus-circle"}`}/>{formData.court_ids.includes(String(previewCourt.id)) ? "Court selected" : "Select this court"}</button>}<a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">Open in Google Maps <i className="bi bi-box-arrow-up-right"/></a></div></aside>}</div>
                    )}
                    {!formData.court_ids.length && venues.length > 0 && <small className="text-danger d-block mt-2">Select at least one court to submit this tournament.</small>}
                    {courtSelectionError && <small className="text-danger d-block mt-2" role="alert">{courtSelectionError}</small>}
                  </section>
                  {selectedCourtCount > 0 && <>
                    <div className="tournament-create-step"><span>3</span><div><b>Court availability &amp; game timing</b><small>Check when the selected court is free, then save.</small></div></div>
                    <section className={`tournament-availability-panel ${availabilitySaved ? "is-saved" : ""}`}>
                      <div className="tournament-weekday-heading"><div><b>When is the court available?</b><span>Select all playable days</span></div><span>{formData.available_days.length}/7 days</span></div>
                      <div className="tournament-weekday-options">{courtWeekdays.map(([value,label]) => {
                        const checked=formData.available_days.includes(value);
                        return <label key={value} className={checked ? "is-checked" : ""}><input type="checkbox" checked={checked} onChange={() => toggleAvailableDay(value)}/><i className={`bi ${checked ? "bi-check-circle-fill" : "bi-circle"}`}/><span>{label}</span></label>;
                      })}</div>
                      <div className="tournament-time-grid">
                        <label><span>Courts open</span><input type="time" className="form-control" required value={formData.schedule_start_time} onChange={(e) => {setAvailabilitySaved(false);setFormData({...formData, schedule_start_time:e.target.value});}}/></label>
                        <label><span>Courts close</span><input type="time" className="form-control" required value={formData.schedule_end_time} onChange={(e) => {setAvailabilitySaved(false);setFormData({...formData, schedule_end_time:e.target.value});}}/></label>
                      </div>
                      <div className="tournament-availability-actions"><button type="button" className={`btn ${availabilitySaved ? "btn-success" : "btn-evsu"}`} onClick={saveCourtAvailability}><i className={`bi ${availabilitySaved ? "bi-check-circle-fill" : "bi-save"} me-1`}/>{availabilitySaved ? "Availability saved" : "Save availability"}</button></div>
                    </section>
                    {availabilitySaved && <div className="tournament-schedule-note"><i className="bi bi-stars"/><div><b>Ready for Schedule Optimization</b><span>{selectedCourtCount} selected court{selectedCourtCount === 1 ? "" : "s"} · {formData.available_days.length} available days · {formData.schedule_start_time}–{formData.schedule_end_time}</span></div></div>}
                  </>}
                </div>
                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-evsu btn-sm tournament-save-button" disabled={!formData.court_ids.length || !availabilitySaved || submittingTournament}>
                    {submittingTournament
                      ? <><span className="spinner-border spinner-border-sm me-2"/>Saving…</>
                      : !formData.court_ids.length
                        ? <><i className="bi bi-arrow-up-circle me-2"/>Select a court first</>
                        : !availabilitySaved
                          ? <><i className="bi bi-clock-history me-2"/>Save availability first</>
                          : <><i className="bi bi-check2-circle me-2"/>Save tournament</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {divisionTournament && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,.55)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header">
                <div>
                  <h5 className="fw-bold mb-0">Tournament Divisions</h5>
                  <small className="text-muted">
                    {divisionTournament.name}
                  </small>
                </div>
                <button
                  className="btn-close"
                  onClick={() => setDivisionTournament(null)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-4">
                  {divisions.map((d) => (
                    <div className="col-md-6" key={d.id}>
                      <div className="border rounded-3 p-3">
                        <div className="d-flex justify-content-between">
                          <b>{d.name}</b>
                          <span className="badge bg-dark">
                            {d.team_count} teams
                          </span>
                        </div>
                        <small className="text-muted">
                          {d.age_group || "Open age"} · {d.gender_category} ·{" "}
                          {d.format.replaceAll("_", " ")}
                        </small>
                        <div className="small text-success mt-1"><i className="bi bi-shield-check me-1"/>Auto-validation: {ageRangeLabel(d)}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-calendar-check me-1"/>Cutoff: {d.age_cutoff_date || divisionTournament.start_date || "Tournament start date"}</div>
                      </div>
                    </div>
                  ))}
                  {divisions.length === 0 && (
                    <p className="text-muted">No divisions yet.</p>
                  )}
                </div>
                <form onSubmit={createDivision}>
                  <h6 className="fw-bold">Add Division</h6>
                  <div className="row g-2">
                    <div className="col-12">
                      <label htmlFor="division-preset" className="form-label small fw-semibold">Quick preset</label>
                      <select id="division-preset" className="form-select" defaultValue="custom" onChange={(e) => applyDivisionPreset(e.target.value)}>
                        <option value="custom">Custom division</option>
                        <option value="12u">12 Under</option>
                        <option value="14u">14 Under</option>
                        <option value="16u">16 Under</option>
                        <option value="18u">18 Under</option>
                        <option value="junior">Junior Category (13–21)</option>
                        <option value="senior">Senior Category (25 and above)</option>
                        <option value="open">Open Age</option>
                      </select>
                      <div className="form-text">Presets fill the fields below. You can still edit the name and age limits.</div>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="division-name" className="form-label small fw-semibold">Division name</label>
                      <input
                        id="division-name"
                        required
                        className="form-control"
                        placeholder="Division name"
                        value={divisionForm.name}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="division-age-label" className="form-label small fw-semibold">Display label (optional)</label>
                      <input
                        id="division-age-label"
                        className="form-control"
                        placeholder="Age group, e.g. Under 18"
                        value={divisionForm.age_group}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            age_group: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <select
                        className="form-select"
                        value={divisionForm.gender_category}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            gender_category: e.target.value,
                          })
                        }
                      >
                        <option value="open">Open</option>
                        <option value="mens">Men's</option>
                        <option value="womens">Women's</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <select
                        className="form-select"
                        value={divisionForm.format}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            format: e.target.value,
                          })
                        }
                      >
                        <option value="round_robin">Round Robin</option>
                        <option value="single_elimination">
                          Single Elimination
                        </option>
                        <option value="group_playoffs">Group + Playoffs</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="division-roster-limit" className="form-label small fw-semibold">Roster limit</label>
                      <input
                        id="division-roster-limit"
                        type="number"
                        className="form-control"
                        value="15"
                        readOnly
                      />
                      <div className="form-text">FullCourt allows up to 15 active players per team.</div>
                    </div>
                    <div className="col-md-4"><label htmlFor="division-min-age" className="form-label small fw-semibold">Minimum age</label><input id="division-min-age" type="number" min="0" max="99" className="form-control" placeholder="No minimum" value={divisionForm.min_age} onChange={e=>setDivisionForm({...divisionForm,min_age:e.target.value})}/></div>
                    <div className="col-md-4"><label htmlFor="division-max-age" className="form-label small fw-semibold">Maximum age</label><input id="division-max-age" type="number" min="0" max="99" className="form-control" placeholder="No maximum" value={divisionForm.max_age} onChange={e=>setDivisionForm({...divisionForm,max_age:e.target.value})}/></div>
                    <div className="col-md-4"><label htmlFor="division-cutoff" className="form-label small fw-semibold">Age cutoff date</label><input id="division-cutoff" type="date" className="form-control" value={divisionForm.age_cutoff_date} onChange={e=>setDivisionForm({...divisionForm,age_cutoff_date:e.target.value})}/><div className="form-text">Blank uses tournament start date.</div></div>
                    <div className="col-12"><div className="alert alert-light border py-2 mb-0 small"><i className="bi bi-info-circle me-2 text-primary"/>{divisionForm.min_age === "" && divisionForm.max_age === "" ? "Open age: no automatic age restriction." : divisionForm.min_age === "" ? `Eligible up to age ${divisionForm.max_age}.` : divisionForm.max_age === "" ? `Eligible from age ${divisionForm.min_age} and above.` : `Eligible from age ${divisionForm.min_age} to ${divisionForm.max_age}.`}</div></div>
                    <div className="col-12">
                      <textarea
                        className="form-control"
                        placeholder="Eligibility requirements"
                        value={divisionForm.eligibility_requirements}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            eligibility_requirements: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button className="btn btn-evsu mt-3">Add Division</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentManagement;
