import ExperienceErrorBoundary from "./ExperienceErrorBoundary.jsx";

export default function AppErrorBoundary({ children }) {
  return (
    <ExperienceErrorBoundary
      experienceKey={
        globalThis.location?.pathname ?? "motion-arcade"
      }
      experienceName="Motion Arcade"
      homeHref="/"
    >
      {children}
    </ExperienceErrorBoundary>
  );
}
