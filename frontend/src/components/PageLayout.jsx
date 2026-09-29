import React from "react";

/**
 * Standard page frame (spec §8.3.3): a narrow header column (H1, one-line description and an
 * optional primary input via `header`) above a wider content column.
 */
export function PageLayout({ title, description, header, children }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl">{title}</h1>
          <p>{description}</p>
        </div>
        {header}
      </div>
      {children}
    </div>
  );
}
