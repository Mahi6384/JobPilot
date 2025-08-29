import React from "react";
import { useState } from "react";
function Dashboard() {
  // const [name, setName] = useState("");
  // const [company, setCompany] = useState("");
  // const [location, setLocation] = useState("");
  // const [experience, setExperience] = useState("");

  const dummyData = [
    {
      name: "Front-end Developer",
      company: "Google",
      location: "Gurgaon",
      experience: "Fresher",
    },
    {
      name: "Back-end Developer",
      company: "Microsoft",
      location: "Delhi",
      experience: "1year",
    },
    {
      name: "Full Stack Developer",
      company: "Amazon",
      location: "Bangalore",
      experience: "2 year",
    },
  ];

  return dummyData.map((jobCard) => (
    <div className=" flex mt-8">
      <div>
        <p>Review Applications and submit</p>
        <div className="bg-slate-600 flex flex-col p-5 text-white">
          <p>JOB Title: {jobCard.name} </p>
          <p>Company Name :{jobCard.company}</p>
          <p>Location : {jobCard.location} </p>
          <p>Experience {jobCard.experience} </p>
          <p>Skills match - 98%</p>
        </div>
      </div>
    </div>
  ));
}

export default Dashboard;
