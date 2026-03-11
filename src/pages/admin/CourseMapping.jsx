import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const NAV_ITEMS = [
{ label: "Dashboard", icon: "⊞", path: "/admin" },
{ label: "Teacher Management", icon: "🎓", path: "/admin/teachers" },
{ label: "Student Management", icon: "👥", path: "/admin/students" },
{ label: "Manage Course", icon: "📚", path: "/admin/add-course" },
{ label: "Manage Class", icon: "🏫", path: "/admin/add-class" },
{ label: "Course Mapping", icon: "🔗", path: "/admin/course-mapping", active: true },
];

const CourseMapping = () => {

const navigate = useNavigate();

const [selectedClass, setSelectedClass] = useState("");
const [selectedCourse, setSelectedCourse] = useState("");
const [selectedTeacher, setSelectedTeacher] = useState("");
const [success, setSuccess] = useState(false);

const [classes, setClasses] = useState([]);
const [courses, setCourses] = useState([]);
const [teachers, setTeachers] = useState([]);

const [mappings, setMappings] = useState([]);
const [showMappings, setShowMappings] = useState(false);

/* FETCH DROPDOWN DATA */

useEffect(() => {

const fetchData = async () => {

try {

const classRes = await fetch("http://localhost:5000/api/course-mapping/classes");
const classData = await classRes.json();
setClasses(Array.isArray(classData) ? classData : []);

const courseRes = await fetch("http://localhost:5000/api/course-mapping/courses");
const courseData = await courseRes.json();
setCourses(Array.isArray(courseData) ? courseData : []);

const teacherRes = await fetch("http://localhost:5000/api/course-mapping/teachers");
const teacherData = await teacherRes.json();
setTeachers(Array.isArray(teacherData) ? teacherData : []);

} catch (err) {
console.error("Dropdown fetch error:", err);
}

};

fetchData();

}, []);

/* MAP COURSE */

const handleMapCourse = async () => {

if (!selectedClass || !selectedCourse || !selectedTeacher) {
alert("Please select class, course and teacher ❌");
return;
}

try {

const response = await fetch("http://localhost:5000/api/course-mapping", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
classId: selectedClass,
courseId: selectedCourse,
teacherId: selectedTeacher
})
});

const text = await response.text();
let result = {};

try {
result = text ? JSON.parse(text) : {};
} catch {
result = { message: text };
}

if (!response.ok) {
alert(result.message || "Mapping failed");
return;
}

alert(result.message || "Course mapped successfully");

setSelectedClass("");
setSelectedCourse("");
setSelectedTeacher("");
setSuccess(true);

} catch (error) {

console.error(error);
alert("Something went wrong!");

}

};

/* VIEW MAPPINGS */

const fetchMappings = async () => {

try {

const res = await fetch("http://localhost:5000/api/course-mapping/mappings");
const data = await res.json();

setMappings(Array.isArray(data) ? data : []);
setShowMappings(true);

} catch (err) {
console.error("Mapping fetch error:", err);
}

};

return (

<div className="container">

{/* Sidebar */}

<aside className="sidebar">

<h2 className="logo">SAGE</h2>

<div className="user-info">
<div className="avatar">A</div>
<div className="user-details">
<h4>Admin1</h4>
<p>System Administrator</p>
</div>
</div>

<ul className="sidebar-cards">

{NAV_ITEMS.map(({ label, icon, path, active }) => (

<li
key={label}
className={active ? "active" : ""}
onClick={() => navigate(path)}
>

<span className="nav-icon">{icon}</span>
{label}

</li>

))}

</ul>

</aside>

{/* Main */}

<main className="main">

<div className="logout-container">

<button
className="com-btn logout-btn-top"
onClick={() => navigate("/login")}

>

↩ Logout </button>

</div>

<h1 className="page-title">
Course <span>Mapping</span>
</h1>

<div className="form-wrapper">

<div className="com-card form-card">

<h3>Map Course to Class & Teacher</h3>

{/* CLASS */}

<select
value={selectedClass}
onChange={(e) => setSelectedClass(e.target.value)}

>

<option value="">Select Class</option>

{Array.isArray(classes) &&
classes.map((cls) => (

<option key={cls._id || cls.classId} value={cls.classId}>
{cls.classId}
</option>
))}

</select>

{/* COURSE */}

<select
value={selectedCourse}
onChange={(e) => {
setSelectedCourse(e.target.value);
setSuccess(false);
}}

>

<option value="">Select Course</option>

{Array.isArray(courses) &&
courses.map((course) => (

<option key={course._id} value={course._id}>
{course.courseName}
</option>
))}

</select>

{/* TEACHER */}

<select
value={selectedTeacher}
onChange={(e) => {
setSelectedTeacher(e.target.value);
setSuccess(false);
}}

>

<option value="">Select Teacher</option>

{Array.isArray(teachers) &&
teachers.map((teacher) => (

<option key={teacher._id} value={teacher._id}>
{teacher.name}
</option>
))}

</select>

<button
className="com-btn primary-btn"
onClick={handleMapCourse}

>

🔗 Map Course </button>

<button
className="com-btn"
style={{ marginTop: "10px" }}
onClick={fetchMappings}

>

👁 View Mappings </button>

{success && (

<p className="success-text">
✅ Course mapped successfully!
</p>
)}

</div>

</div>

{/* MAPPINGS TABLE */}

{showMappings && (

<div className="mapping-wrapper">

<div className="com-card mapping-card">

<h3>Existing Course Mappings</h3>

<table className="mapping-table">

<thead>
<tr>
<th>Class</th>
<th>Course</th>
<th>Teacher</th>
</tr>
</thead>

<tbody>

{Array.isArray(mappings) &&
mappings.map((map) => (

<tr key={map._id}>

<td>{map.classId?.classId}</td>
<td>{map.courseId?.courseName}</td>
<td>{map.teacherId?.name}</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

)}

</main>

</div>

);

};

export default CourseMapping;
