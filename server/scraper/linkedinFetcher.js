const config = require("./config");

const JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com/search";

function buildRequestOptions(query, page = 1) {
  const params = new URLSearchParams({
    query: `${query} India`,
    page: page.toString(),
    num_pages: "1",
    date_posted: config.linkedinDatePosted || "week",
  });

  return {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": config.jsearchApiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  };
}

function filterLinkedinJobs(jobs) {
  return jobs.filter((job) => {
    const isLinkedIn = job.job_apply_link?.includes("linkedin.com");
    return isLinkedIn;
  });
}

function mapToRawJob(job) {
  // Extract location
  const locationParts = [job.job_city, job.job_state, job.job_country].filter(
    Boolean,
  );
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Not specified";

  // Extract skills from qualifications/highlights
  const skills = [];
  if (job.job_required_skills && Array.isArray(job.job_required_skills)) {
    skills.push(...job.job_required_skills);
  }
  if (job.job_highlights?.Qualifications) {
    // Extract short skill-like items from qualifications
    job.job_highlights.Qualifications.forEach((q) => {
      if (q.length < 40) skills.push(q);
    });
  }

  // Extract experience
  const expMin = job.job_required_experience?.required_experience_in_months
    ? Math.floor(job.job_required_experience.required_experience_in_months / 12)
    : 0;
  const expMax = job.job_required_experience?.required_experience_in_months
    ? Math.ceil(job.job_required_experience.required_experience_in_months / 12) + 1
    : 2;

  return {
    title: job.job_title || "Unknown",
    company: job.employer_name || "Unknown",
    location,
    experience: `${expMin}-${expMax} Yrs`,
    salary:
      job.job_min_salary && job.job_max_salary
        ? `${job.job_min_salary}-${job.job_max_salary}`
        : "Not disclosed",
    salaryMin: job.job_min_salary || 0,
    salaryMax: job.job_max_salary || 0,
    skills: skills.slice(0, 10),
    description: job.job_description?.substring(0, 500) || "",
    applicationUrl: job.job_apply_link || "",
    postedDate: job.job_posted_at_datetime_utc
      ? new Date(job.job_posted_at_datetime_utc)
      : new Date(),
  };
}

async function scrapeQuery(query) {
  if (!config.jsearchApiKey) {
    console.log("   ⚠️  JSEARCH_API_KEY not set, skipping LinkedIn fetch");
    return [];
  }

  const allJobs = [];

  try {
    const params = new URLSearchParams({
      query: `${query} India`,
      page: "1",
      num_pages: "1",
      date_posted: config.linkedinDatePosted || "week",
    });

    const url = `${JSEARCH_BASE_URL}?${params.toString()}`;
    console.log(`   🔗 Fetching LinkedIn jobs from JSearch API...`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": config.jsearchApiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ JSearch API error (${response.status}): ${errorText.substring(0, 100)}`);
      return [];
    }

    const data = await response.json();
    const results = data.data || [];
    console.log(`   📦 JSearch returned ${results.length} total jobs`);

    // Filter for LinkedIn jobs only
    const linkedinJobs = filterLinkedinJobs(results);
    console.log(`   🎯 ${linkedinJobs.length} LinkedIn jobs found`);

    // Map to our raw job format
    const mappedJobs = linkedinJobs
      .slice(0, config.linkedinMaxJobsPerQuery || 15)
      .map(mapToRawJob)
      .filter((job) => job.applicationUrl); // Must have a valid URL

    allJobs.push(...mappedJobs);
  } catch (error) {
    console.log(`   ❌ LinkedIn fetch error: ${error.message}`);
  }

  return allJobs;
}

module.exports = { scrapeQuery, filterLinkedinJobs, mapToRawJob };
