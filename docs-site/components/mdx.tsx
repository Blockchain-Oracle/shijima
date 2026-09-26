import defaultComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { Addr, Example, Fact, Facts } from './content';
import { Diagram } from './diagram';
import { Logo, Named, Partners } from './logo';
import { Sequence } from './sequence';
import { AppLink, JourneyList, ProductMap, WelcomeActions } from './welcome';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultComponents,
    Callout,
    Step,
    Steps,
    Tab,
    Tabs,
    Addr,
    Example,
    Fact,
    Facts,
    Diagram,
    Sequence,
    Logo,
    Named,
    Partners,
    AppLink,
    JourneyList,
    ProductMap,
    WelcomeActions,
    ...components,
  } satisfies MDXComponents;
}
export const useMDXComponents = getMDXComponents;
declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
