import React, { useEffect, useState } from "react";
import axios from "axios";

function ShowJobs() {
  const [jobs, setJobs] = useState([]);
  async function getJob() {
    try {
      const response = await axios.get("http://localhost:5000/api/jobs");
      setJobs(response.data.data);
    } catch (error) {
      console.log("Error", error);
    }
  }
  useEffect(() => {
    getJob();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-12 font-montserrat font-medium">
      {jobs.map((jobCard, index) => (
        <div key={index} className="flex flex-col items-center">
          <div className="bg-white/80 w-full max-w-sm  text-black p-8 rounded-t-md">
            {/* <div className="bg-gray-950 w-full max-w-sm shadow-[0_0_10px_2px_theme(colors.blue.900)] text-blue-600 p-8 rounded-t-md"> */}
            <p className="truncate">Name : {jobCard.title}</p>
            <p className="truncate">Company : {jobCard.companyName}</p>
            <p className="truncate">Location : {jobCard.location}</p>
            <p className="truncate">Experience : {jobCard.experience}</p>
          </div>
          <button className="w-full max-w-sm bg-white/60 text-gray-950 text-lg py-3 rounded-b-md">
            {/* <button className="w-full max-w-sm shadow-[0_3px_15px_2px_theme(colors.blue.900)] bg-blue-900 text-gray-950 text-lg py-3 rounded-b-md"> */}
            Apply
          </button>
        </div>
      ))}
    </div>
  );
}

export default ShowJobs;
