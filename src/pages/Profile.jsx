import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../pages/admin/AdminDashboard.css";

const Profile = () => {

  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {

  const fetchProfile = async () => {

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    let url = "";

    if(role === "student")
      url = "http://localhost:5000/api/students/profile";

    if(role === "teacher")
      url = "http://localhost:5000/api/teacherlogin/profile";

    if(role === "admin")
      url = "http://localhost:5000/api/admin/profile";

    const res = await fetch(url,{
      headers:{
        Authorization:`Bearer ${token}`
      }
    });

    const data = await res.json();

    // attach role manually
    setUser({ ...data, role });

  };

  fetchProfile();

}, []);

if (!user) return <p>Loading...</p>;

  return (

    <div className="container">

      {/* Sidebar */}
      <aside className="sidebar">

        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>

          <div className="user-details">
            <h4>{user?.name}</h4>
            <p>{user?.role}</p>
          </div>
        </div>

      </aside>

      {/* Main */}
      <main className="main">

        <div className="logout-container">
          <button
            className="com-btn logout-btn-top"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        </div>

        <h1 className="page-title">
          My <span>Profile</span>
        </h1>

        <div className="com-card" style={{ maxWidth: "500px" }}>

          <div className="profile-field">
            <label>Name</label>
            <p>{user?.name}</p>
          </div>

          <div className="profile-field">
            <label>Email</label>
            <p>{user?.email}</p>
          </div>

          {/* Student extra fields */}
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

        </div>

      </main>

    </div>

  );
};

export default Profile;