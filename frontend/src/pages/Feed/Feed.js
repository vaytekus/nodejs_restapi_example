import React, { Component, Fragment } from 'react';
import io from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';

const API_URL = 'http://localhost:8080';

/** Build full image URL; idempotent if imageUrl is already absolute. */
function toFullImageUrl(imageUrl) {
  if (!imageUrl) return null;
  return imageUrl.startsWith('http') ? imageUrl : `${API_URL}/${imageUrl.replace(/^\//, '')}`;
}

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    fetch('URL')
      .then(res => {
        if (res.status !== 200) {
          throw new Error('Failed to fetch user status.');
        }
        return res.json();
      })
      .then(resData => {
        this.setState({ status: resData.status });
      })
      .catch(this.catchError);

    this.loadPosts();

    this.socket = io('http://localhost:8080', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('posts', ({ action, post, postId }) => {
      if (action === 'create') {
        this.addPost(post);
      } else if (action === 'update') {
        this.updatePost(post);
      } else if (action === 'delete' && postId) {
        this.deletePost(postId);
      }
    });
  }

  componentWillUnmount() {
    if (this.socket) this.socket.disconnect();
  }

  addPost = post => {
    if (!post || !post._id) return;
    this.setState(prevState => {
      if (prevState.posts.some(p => p._id === post._id)) return prevState;
      const newPost = {
        ...post,
        imagePath: toFullImageUrl(post.imageUrl)
      };
      if (prevState.postPage === 1) {
        return {
          posts: [newPost, ...prevState.posts],
          totalPosts: prevState.totalPosts + 1,
          postPage: 1
        };
      }
      return {
        postPage: 1,
        postsLoading: true
      };
    }, () => {
      if (this.state.postsLoading) this.loadPosts();
    });
  };

  updatePost = post => {
    this.setState(prevState => {
      const idx = prevState.posts.findIndex(p => p._id === post._id);
      if (idx === -1) return prevState;
      const updated = [...prevState.posts];
      const existing = updated[idx];
      const merged = {
        ...existing,
        ...post,
        imagePath: toFullImageUrl(post.imageUrl) || existing.imagePath,
        creator: post.creator && post.creator.name ? post.creator : existing.creator
      };
      updated[idx] = merged;
      return { posts: updated };
    });
  };

  deletePost = postId => {
    this.setState(prevState => ({
      posts: prevState.posts.filter(p => p._id !== postId),
      totalPosts: Math.max(0, prevState.totalPosts - 1)
    }));
  };

  loadPosts = direction => {
    const page = direction
      ? (direction === 'next' ? this.state.postPage + 1 : this.state.postPage - 1)
      : this.state.postPage;
    if (direction) {
      this.setState({ postsLoading: true, posts: [], postPage: page });
    }

    fetch('http://localhost:8080/feed/posts?page=' + page, {
      credentials: 'include',
      headers: this.props.token ? { 'Authorization': 'Bearer ' + this.props.token } : {}
    })
      .then(res => {
        if (res.status !== 200) {
          throw new Error('Failed to fetch posts.');
        }
        return res.json();
      })
      .then(resData => {
        this.setState({
          // posts: resData.posts,
          posts: resData.posts.map(post => ({
            ...post,
            imagePath: toFullImageUrl(post.imageUrl)
          })),
          totalPosts: resData.totalItems,
          postsLoading: false
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    fetch('URL')
      .then(res => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error("Can't update status!");
        }
        return res.json();
      })
      .then(resData => {
        console.log(resData);
      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = postData => {
    this.setState({
      editLoading: true
    });
    const formData = new FormData();
    formData.append('title', postData.title);
    formData.append('content', postData.content);
    formData.append('image', postData.image);
    formData.append('creator', 'Art');

    let url = 'http://localhost:8080/feed/post';
    let method = 'POST';

    if (this.state.editPost) {
      url = 'http://localhost:8080/feed/post/' + this.state.editPost._id;
      method = 'PUT';
    }

    fetch(url, {
      method: method,
      body: formData,
      credentials: 'include',
      headers: this.props.token ? { 'Authorization': 'Bearer ' + this.props.token } : {}
    })
      .then(async res => {
        if (res.status !== 200 && res.status !== 201) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Creating or editing a post failed!');
        }
        return res.json();
      })
      .then(resData => {
        const post = {
          _id: resData.post._id,
          title: resData.post.title,
          content: resData.post.content,
          imageUrl: resData.post.imageUrl,
          creator: resData.post.creator,
          createdAt: resData.post.createdAt
        };
        let isCreate = false;
        this.setState(prevState => {
          if (prevState.editPost) {
            const postIndex = prevState.posts.findIndex(
              p => p._id === prevState.editPost._id
            );
            const updated = [...prevState.posts];
            updated[postIndex] = {
              ...post,
              imagePath: toFullImageUrl(post.imageUrl) || prevState.posts[postIndex].imagePath
            };
            return {
              posts: updated,
              isEditing: false,
              editPost: null,
              editLoading: false
            };
          }
          isCreate = true;
          return {
            postPage: 1,
            postsLoading: true,
            isEditing: false,
            editPost: null,
            editLoading: false
          };
        }, () => {
          if (isCreate) this.loadPosts();
        });
      })
      .catch(err => {
        this.setState({
          isEditing: false,
          editPost: null,
          editLoading: false,
          error: err
        });
      });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });
    fetch('http://localhost:8080/feed/post/' + postId, {
      method: 'DELETE',
      credentials: 'include',
      headers: this.props.token ? { 'Authorization': 'Bearer ' + this.props.token } : {}
    })
      .then(res => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error('Deleting a post failed!');
        }
        return res.json();
      })
      .then(resData => {
        console.log(resData);
        this.setState(prevState => {
          const updatedPosts = prevState.posts.filter(p => p._id !== postId);
          return { posts: updatedPosts, postsLoading: false };
        });
      })
      .catch(err => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imagePath || toFullImageUrl(post.imageUrl)}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
