import { createFileRoute } from "@tanstack/react-router";
import i18next from "i18next";
import React from "react";
import { Trans } from "react-i18next";
import { Header } from "./Header";

type User = {
	name: string;
};

export const Route = createFileRoute("/")({
	component: () => <Page />,
});

const Page: React.FC = () => {
	const [user, setUser] = React.useState<User>();

	return (
		<article>
			<Header
				user={user}
				onLogin={() => setUser({ name: i18next.t("janeDoe", "Jane Doe") })}
				onLogout={() => setUser(undefined)}
				onCreateAccount={() =>
					setUser({ name: i18next.t("janeDoe", "Jane Doe") })
				}
			/>

			<section className="storybook-page">
				<h2>{i18next.t("pagesInStorybook", "Pages in Storybook")}</h2>
				<p>
					{i18next.t(
						"weRecommendBuildingUisWithA",
						"We recommend building UIs with a",
					)}{" "}
					<a
						href="https://componentdriven.org"
						target="_blank"
						rel="noopener noreferrer"
					>
						<strong>component-driven</strong>
					</a>{" "}
					{i18next.t(
						"processStartingWithAtomicComponentsAndEndingWithPages",
						"process starting with atomic components and ending with pages.",
					)}
				</p>
				<p>
					{i18next.t(
						"renderPagesWithMockDataThisMakesItEasyToBuildAndReviewPageStatesWithoutNeedingToNavigateToThemInYourAppHereAreSomeHandyPatternsForManagingPageDataInStorybook",
						"Render pages with mock data. This makes it easy to build and review\n\t\t\t\t\tpage states without needing to navigate to them in your app. Here are\n\t\t\t\t\tsome handy patterns for managing page data in Storybook:",
					)}
				</p>
				<ul>
					<li>
						{i18next.t(
							"useAHigherlevelConnectedComponentStorybookHelpsYouComposeSuchDataFromTheArgsOfChildComponentStories",
							'Use a higher-level connected component. Storybook helps you compose\n\t\t\t\t\t\tsuch data from the "args" of child component stories',
						)}
					</li>
					<li>
						{i18next.t(
							"assembleDataInThePageComponentFromYourServicesYouCanMockTheseServicesOutUsingStorybook",
							"Assemble data in the page component from your services. You can mock\n\t\t\t\t\t\tthese services out using Storybook.",
						)}
					</li>
				</ul>
				<p>
					{i18next.t(
						"getAGuidedTutorialOnComponentdrivenDevelopmentAt",
						"Get a guided tutorial on component-driven development at",
					)}{" "}
					<a
						href="https://storybook.js.org/tutorials/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Storybook tutorials
					</a>
					. Read more in the{" "}
					<a
						href="https://storybook.js.org/docs"
						target="_blank"
						rel="noopener noreferrer"
					>
						docs
					</a>
					.
				</p>

				<div className="tip-wrapper">
					<span className="tip">Tip</span> Adjust the width of the canvas with
					the{" "}
					<svg
						width="10"
						height="10"
						viewBox="0 0 12 12"
						xmlns="http://www.w3.org/2000/svg"
					>
						<g fill="none" fillRule="evenodd">
							<path
								d="M1.5 5.2h4.8c.3 0 .5.2.5.4v5.1c-.1.2-.3.3-.4.3H1.4a.5.5 0 01-.5-.4V5.7c0-.3.2-.5.5-.5zm0-2.1h6.9c.3 0 .5.2.5.4v7a.5.5 0 01-1 0V4H1.5a.5.5 0 010-1zm0-2.1h9c.3 0 .5.2.5.4v9.1a.5.5 0 01-1 0V2H1.5a.5.5 0 010-1zm4.3 5.2H2V10h3.8V6.2z"
								id="a"
								fill="#999"
							/>
						</g>
					</svg>
					{i18next.t(
						"viewportsAddonInTheToolbar",
						"Viewports addon in the toolbar",
					)}
				</div>
			</section>
		</article>
	);
};
