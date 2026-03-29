import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../pages/admin/AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState({ msg: "", type: "" }); // type: "success" | "error"
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");
      let url = "";
      if (role === "student") url = `${API_BASE}/api/students/profile`;
      if (role === "teacher") url = `${API_BASE}/api/teacherlogin/profile`;
      if (role === "admin") url = `${API_BASE}/api/admin/profile`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUser({ ...data, role });
    };
    fetchProfile();
  }, []);

  const handlePwChange = async () => {
    setPwStatus({ msg: "", type: "" });

    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      return setPwStatus({ msg: "All fields are required.", type: "error" });
    }
    if (pwForm.newPw !== pwForm.confirm) {
      return setPwStatus({ msg: "New passwords do not match.", type: "error" });
    }
    if (pwForm.newPw.length < 6) {
      return setPwStatus({ msg: "Password must be at least 6 characters.", type: "error" });
    }

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    let url = "";
    if (role === "student") url = `${API_BASE}/api/students/change-password`;
    if (role === "teacher") url = `${API_BASE}/api/teacherlogin/change-password`;
    if (role === "admin") url = `${API_BASE}/api/admin/change-password`;

    try {
      setPwLoading(true);
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.newPw,
        }),
      });
      const data = await res.json();
     if (res.ok) {
  setPwStatus({ msg: "Password changed successfully! Redirecting to login...", type: "success" });
  setPwForm({ current: "", newPw: "", confirm: "" });
  setTimeout(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  }, 2000);
} else {
  setPwStatus({ msg: data.message || "Failed to change password.", type: "error" });
}
} catch {
  setPwStatus({ msg: "Network error. Please try again.", type: "error" });
} finally {
  setPwLoading(false);
}
};

  if (!user) return <p>Loading...</p>;

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        <div className="user-info">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <div className="user-details">
            <h4>{user?.name}</h4>
            <p>{user?.role}</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        <h1 className="page-title">
          My <span>Profile</span>
        </h1>

        {/* Profile Info Card */}
        <div className="com-card" style={{ maxWidth: "500px" }}>
          <div className="profile-field">
            <label>Name</label>
            <p>{user?.name}</p>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <p>{user?.email}</p>
          </div>

          {user?.role === "student" && (
            <>
              <div className="profile-field">
                <label>Admission Number</label>
                <p>{user?.admnNo}</p>
              </div>
              <div className="profile-field">
                <label>Roll Number</label>
                <p>{user?.rollNo}</p>
              </div>
              <div className="profile-field">
                <label>Batch</label>
                <p>{user?.classId}</p>
              </div>
              <div className="profile-field">
                <label>Semester</label>
                <p>{user?.semester}</p>
              </div>
            </>
          )}

          {/* Toggle Button */}
          <div style={{ marginTop: "20px" }}>
            <button
              className="com-btn"
              onClick={() => {
                setShowChangePw((v) => !v);
                setPwStatus({ msg: "", type: "" });
                setPwForm({ current: "", newPw: "", confirm: "" });
              }}
            >
              {showChangePw ? "✕ Cancel" : "🔒 Change Password"}
            </button>
          </div>
        </div>

        {/* Change Password Card */}
        {showChangePw && (
          <div className="com-card" style={{ maxWidth: "500px", marginTop: "16px" }}>
            <h3 className="section-title" style={{ marginBottom: "16px" }}>
              Change Password
            </h3>

            <div className="profile-field">
              <label>Current Password</label>
              <input
                className="com-input"
                type="password"
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              />
            </div>

            <div className="profile-field">
              <label>New Password</label>
              <input
                className="com-input"
                type="password"
                placeholder="Enter new password"
                value={pwForm.newPw}
                onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
              />
            </div>

            <div className="profile-field">
              <label>Confirm New Password</label>
              <input
                className="com-input"
                type="password"
                placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              />
            </div>

            {/* Status message */}
            {pwStatus.msg && (
              <div
                className={`info-banner ${
                  pwStatus.type === "success" ? "info-banner--success" : "info-banner--error"
                }`}
                style={{ marginTop: "12px", marginBottom: "4px" }}
              >
                <span>{pwStatus.type === "success" ? "✓" : "✕"}</span>
                <p className="info-banner-text">{pwStatus.msg}</p>
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                className="com-btn com-btn-primary"
                onClick={handlePwChange}
                disabled={pwLoading}
              >
                {pwLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
