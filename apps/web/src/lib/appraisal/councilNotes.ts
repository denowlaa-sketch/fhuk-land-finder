export interface Citation {
  label: string;
  url: string;
  date: string;
  value: string;
}

export interface HousingSiteHit {
  name: string;
  dataset: string;
  reference: string | null;
}

export interface CilDocument {
  name: string;
  documentUrl: string | null;
  documentationUrl: string | null;
  adoptedDate: string | null;
}

export interface CouncilNotes {
  cilRatePerM2: number | null;
  cilSummary: string;
  s106Amount: number | null;
  s106Summary: string;
  onPublishedSite: boolean;
  siteSummary: string;
  buildSummary: string;
  citations: Citation[];
}

const WEST_LANCS = "E07000127";
const RETRIEVED = "23 November 2026";

const BUILD_SUMMARY =
  "No free published build-cost rate was found for this postcode. BCIS is paid and was not used, so the £ per square foot stays blank.";

function siteList(sites: HousingSiteHit[]): string {
  if (sites.length === 0) return "";
  return sites
    .map((site) => {
      const ref = site.reference ? ` (${site.reference})` : "";
      return `${site.name || "Unnamed site"}${ref}, ${site.dataset}`;
    })
    .join("; ");
}

export function describeCouncil(input: {
  postcode: string;
  authorityName: string;
  gss: string | null;
  website: string | null;
  websiteStatus: number | null;
  cilDocuments: CilDocument[];
  sites: HousingSiteHit[];
}): CouncilNotes {
  const citations: Citation[] = [];
  const listed = siteList(input.sites);
  const westLancs = input.gss === WEST_LANCS;

  if (westLancs && input.postcode === "PR4 6AP") {
    citations.push(
      {
        label: "West Lancashire SHELAA 2020/21, Tarleton sites",
        url: "https://www.westlancs.gov.uk/media/546578/shelaa20-21_tarleton.pdf",
        date: "SHELAA 2020/21, read 23 November 2026",
        value:
          "PR4 6AP does not appear. Site TA.072, Avenue Farm, 219 Hesketh Lane, is addressed PR4 6AT, south of Fermor Road. It is parked as Green Belt, with an estimated yield of 180 that the schedule does not count as expected completions.",
      },
      {
        label: "West Lancashire SHELAA index",
        url: "https://www.westlancs.gov.uk/planning/planning-policy/the-local-plan/the-local-plan-2023-2040/evidence-base/shelaa.aspx",
        date: "SHELAA 2020/21",
        value: "The council publishes the assessment as settlement PDFs rather than a document titled SHLAA.",
      },
    );
  } else if (westLancs) {
    citations.push({
      label: "West Lancashire SHELAA index",
      url: "https://www.westlancs.gov.uk/planning/planning-policy/the-local-plan/the-local-plan-2023-2040/evidence-base/shelaa.aspx",
      date: "SHELAA 2020/21",
      value:
        "Settlement PDFs are published. The PDF for this postcode was not opened, so no site or capacity is claimed from it.",
    });
  }

  let siteSummary: string;
  if (westLancs && input.postcode === "PR4 6AP") {
    siteSummary =
      "PR4 6AP is not on a published SHELAA site. The 2020/21 Tarleton schedule does not contain that postcode. Site TA.072 (PR4 6AT, south of Fermor Road) is a different postcode and is parked as Green Belt, so its estimated yield is not used.";
    if (input.sites.length === 0) {
      siteSummary +=
        " planning.data.gov.uk also returns no brownfield land, brownfield site, or development site at this postcode.";
    } else {
      siteSummary += ` planning.data.gov.uk returns: ${listed}.`;
    }
  } else if (input.sites.length === 0) {
    siteSummary = `${input.postcode} is not on a published housing site in planning.data.gov.uk (brownfield land, brownfield site, and development site).`;
    if (westLancs) {
      siteSummary +=
        " West Lancashire’s current assessment is the SHELAA 2020/21. The settlement PDF for this postcode was not opened, so no allocation is claimed from it.";
    } else if (input.websiteStatus === 403) {
      siteSummary += ` ${input.website ?? "The council website"} returned 403, so its SHLAA or HELAA page was not read.`;
    } else if (input.website) {
      siteSummary += ` No SHLAA or HELAA tariff or site for this postcode was read from ${input.website}.`;
    }
  } else {
    siteSummary = `planning.data.gov.uk returns ${listed}. Only fields on those records are used.`;
  }

  const onPublishedSite = input.sites.length > 0;

  let cilSummary: string;
  let cilRatePerM2: number | null = null;
  if (westLancs) {
    cilRatePerM2 = null;
    cilSummary =
      "West Lancashire’s adopted charging schedule (September 2014) sets residential dwellings at £85/m² in Zone A and nil in Zone B. Zone A is the rest of the borough outside Zone B, and Zone B is map-defined. The 2026 rate summary indexes Zone A to £143.45/m² (index 400 ÷ 237 × £85) and leaves Zone B at £0. The zone for this postcode was not identified, so no CIL rate is applied.";
    citations.push(
      {
        label: "West Lancashire CIL annual rate summary 2026",
        url: "https://www.westlancs.gov.uk/media/548513/2026-cil-rate-summary.pdf",
        date: "2026 summary, retrieved 23 November 2026",
        value: "Residential dwellings £143.45/m² in Zone A and £0 in Zone B. Not applied: the zone is not known from the postcode.",
      },
      {
        label: "West Lancashire adopted CIL charging schedule",
        url: "https://www.westlancs.gov.uk/media/132575/Adopted-Charging-Schedule_Sept-2014.pdf",
        date: "September 2014",
        value: "Residential dwelling house £85/m² in Zone A and nil in Zone B.",
      },
      {
        label: "West Lancashire CIL page",
        url: "https://www.westlancs.gov.uk/planning/planning-policy/community-infrastructure-levy.aspx",
        date: RETRIEVED,
        value: "Links the current indexed rate summary.",
      },
    );
    for (const doc of input.cilDocuments) {
      if (doc.documentUrl) {
        citations.push({
          label: doc.name || "CIL schedule on planning.data.gov.uk",
          url: doc.documentUrl,
          date: doc.adoptedDate || "Registered on planning.data.gov.uk",
          value: "National register entry. The indexed 2026 summary is the later rate note.",
        });
      }
    }
  } else if (input.cilDocuments.length === 0) {
    cilSummary = `${input.authorityName} has no community infrastructure levy charging schedule in the planning.data.gov.uk register. No £/m² is applied. West Lancashire’s £143.45/m² is not used outside that borough.`;
    if (input.websiteStatus === 403 && input.website) {
      cilSummary += ` ${input.website} returned 403, so a schedule was not read from the council site.`;
    }
  } else {
    cilSummary = `${input.authorityName} has a charging schedule on planning.data.gov.uk. The £/m² was not read out of that document for this lookup, so no rate is applied.`;
    for (const doc of input.cilDocuments) {
      const url = doc.documentUrl || doc.documentationUrl;
      if (!url) continue;
      citations.push({
        label: doc.name || `${input.authorityName} CIL schedule`,
        url,
        date: doc.adoptedDate || "Registered on planning.data.gov.uk",
        value: "Schedule is registered. No £/m² was extracted, so the charge is blank.",
      });
    }
  }

  let s106Amount: number | null = null;
  let s106Summary: string;
  if (westLancs) {
    s106Amount = null;
    s106Summary =
      "West Lancashire’s Section 106 costs page (updated 2 January 2026) states legal fees: £1,307.59 to draft an agreement, £660.40 for a unilateral undertaking, and £500 monitoring per obligation. Those are not a per-dwelling infrastructure tariff, so they are not entered as the Section 106 contribution. The Open Space SPD (adopted July 2014) states annual maintenance of £0.47/m² for grass, £1.81/m² for shrub beds, and £9,870 a year for a children’s play area. The open space to be provided is not known, so those rates are not turned into a capital sum.";
    citations.push(
      {
        label: "West Lancashire S106 templates and costs",
        url: "https://www.westlancs.gov.uk/planning/how-to-apply-for-planning-permission/section-106-information/s106-and-unilateral-undertaking-templates-and-costs.aspx",
        date: "Page updated 2 January 2026",
        value: "Drafting £1,307.59, unilateral undertaking £660.40, monitoring £500 per obligation. Not used as the contribution.",
      },
      {
        label: "West Lancashire Open Space SPD (2014)",
        url: "https://www.westlancs.gov.uk/media/172497/Open-Space-SPD-2014-.pdf",
        date: "Adopted July 2014",
        value:
          "Annual maintenance £0.47/m² grass, £1.81/m² shrub beds, and £9,870 a year for a children’s play area. Not applied: the open space area of this scheme is not stated.",
      },
    );
  } else {
    s106Amount = null;
    s106Summary = `No per-dwelling Section 106 or SPD tariff was read for ${input.authorityName}, so the contribution is blank.`;
    if (input.websiteStatus === 403 && input.website) {
      s106Summary += ` ${input.website} returned 403.`;
    } else if (input.website) {
      s106Summary += ` Council site: ${input.website}.`;
    }
  }

  return {
    cilRatePerM2,
    cilSummary,
    s106Amount,
    s106Summary,
    onPublishedSite,
    siteSummary,
    buildSummary: BUILD_SUMMARY,
    citations,
  };
}
