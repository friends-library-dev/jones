import React from 'react';
import debounce from 'lodash/debounce';
import { connect } from 'react-redux';
import styled from '@emotion/styled';
import { Global, css } from '@emotion/core';
import { Uuid, Html } from '@friends-library/types';
import { ParserError } from '@friends-library/evaluator';
import { State as AppState } from '../../type';
import chapterHtml from '../../lib/chapter-html';
import Centered from '../Centered';
import throbber from '../../assets/throbber.gif';

const Rendered = styled.div`
  background: #eaeaea;
  color: black;
  min-height: 100vh;

  .page {
    background: white;
    max-width: 650px;
    padding: 0 75px 75px 75px;
    margin: auto;
    min-height: 100vh;
  }
`;

const globalStyles = css`
  * {
    user-select: auto !important;
  }

  html {
    font-size: 12.5pt !important;
    background: #eaeaea;
    counter-reset: footnotes;
  }

  .chapter {
    margin-top: 0 !important;
    padding-top: 1.125in !important;
  }

  .footnote {
    counter-increment: footnotes;
    font-size: 0 !important;
    width: 0;
  }

  span.footnote::before {
    content: counter(footnotes);
    font-size: 0.85rem;
    display: inline-block;
    transform: translateY(-7px);
  }

  span.footnote > * {
    display: none !important;
  }

  pre.error {
    font-size: 14px;
    color: #ff7e7e;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    margin: 0;
    padding: 2em;
  }
`;

interface OwnProps {
  taskId: Uuid;
  file: string;
}

type Props = OwnProps & {
  getHtml: () => Html;
};

interface State {
  html: Html;
}

class Component extends React.Component<Props, State> {
  public state: State = { html: `` };

  public componentDidMount(): void {
    window.addEventListener(`scroll`, this.watchScroll);

    // prepping HTML for a big file can take 1-5 SECONDS
    // so DEFER so that we can show the throbber while waiting
    const { getHtml } = this.props;
    setTimeout(() => {
      this.setState({ html: getHtml() });
      this.restoreScroll();
    }, 100);
  }

  public componentWillUnmount(): void {
    window.removeEventListener(`scroll`, this.watchScroll);
  }

  protected restoreScroll(): void {
    const savedScroll = sessionStorage.getItem(this.scrollKey());
    if (savedScroll) {
      window.scrollTo(0, Number(savedScroll));
    }
  }

  protected scrollKey(): string {
    const { taskId, file } = this.props;
    return `scroll:${taskId}--${file}`;
  }

  protected watchScroll = debounce(() => {
    sessionStorage.setItem(this.scrollKey(), String(window.scrollY));
  }, 200);

  public render(): JSX.Element {
    const { html } = this.state;
    return (
      <Rendered className="body">
        <Global styles={globalStyles} />
        <div className="page">
          {html ? (
            <div className="inner" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <Centered>
              <h1 style={{ height: `100vh`, opacity: 0.8, lineHeight: `100vh` }}>
                <img alt="" src={throbber} style={{ height: 45 }} />
              </h1>
            </Centered>
          )}
        </div>
      </Rendered>
    );
  }
}

const mapState = (state: AppState, { taskId, file }: OwnProps): Props => {
  const getHtml = (): Html => {
    try {
      return chapterHtml(state, taskId, file);
    } catch (err) {
      if (err instanceof ParserError) {
        return `<pre class="error parse-error">${err.codeFrame}</pre>`;
      }
      return `<pre class="error">${err.message}</pre>`;
    }
  };
  return {
    taskId,
    file,
    getHtml,
  };
};

export default connect(mapState)(Component);
