"use strict";

const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/******************************************************************************
 * Story: a single story in the system
 */

class Story {

  /** Make instance of Story from data object about story:
   *   - {title, author, url, username, storyId, createdAt}
   */

  constructor({ storyId, title, author, url, username, createdAt }) {
    this.storyId = storyId;
    this.title = title;
    this.author = author;
    this.url = url;
    this.username = username;
    this.createdAt = createdAt;
  }

  /** Parses hostname out of URL and returns it. */

  getHostName() {
    const domain = this.url.split("/")[2]; //splits url based on /, takes the domain, which comes after the first 2 slashes 
    const hostnames = domain.split("."); //splits the domain into its parts, with subdomains on the left and the tld on the right
    const hostname = hostnames[hostnames.length - 2] // we want the domain that is one left of the tld
    return hostname;
  }

}


/******************************************************************************
 * List of Story instances: used by UI to show story lists in DOM.
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /** Generate a new StoryList. It:
   *
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.
   */

  static async getStories() {

    // query the /stories endpoint (no auth required)
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "GET",
    });

    // turn plain old story objects from API into instances of Story class
    const stories = response.data.stories.map(story => new Story(story));

    // build an instance of our own class using the new array of stories
    return new StoryList(stories);
  }

  /** Adds story data to API, makes a Story instance, adds it to story list.
   * - user - the current instance of User who will post the story
   * - obj of {title, author, url}
   *
   * Returns the new Story instance
   */

  async addStory(user, newStory) {
    //validation
    if(!newStory.title || !newStory.author || !newStory.url){
      return "Invalid story passed to addStory";
    }
    if(!(user instanceof User)){
      return "Invalid user object passed to addStory";
    }
    try{
      const res = await axios.post(`${BASE_URL}/stories`, 
      {
        token: user.loginToken,
        story: {
          author: newStory.author,
          title: newStory.title,
          url: newStory.url
        }
      })
      if(res.status === 200){
        user.ownStories.push(res.data.story.map(story => new Story(story)))
      }
      return res.data;
    }
    catch(e){
      if(e.code === "ERR_BAD_REQUEST"){
        window.alert("Bad request, please make sure the URL is formatted properly ex: `https://www.google.com`")
      }
    }
    
  }
}


/******************************************************************************
 * User: a user in the system (only used to represent the current user)
 */

class User {
  /** Make user instance from obj of user data and a token:
   *   - {username, name, createdAt, favorites[], ownStories[]}
   *   - token
   */

  constructor({username, name, createdAt, favorites = [], ownStories = []}, token) 
    {
      this.username = username;
      this.name = name;
      this.createdAt = createdAt;

      // instantiate Story instances for the user's favorites and ownStories
      this.favorites = favorites.map(s => new Story(s));
      this.ownStories = ownStories.map(s => new Story(s));

      // store the login token on the user so it's easy to find for API calls.
      this.loginToken = token;
    }

  /** Register new user in API, make User instance & return it.
   *
   * - username: a new username
   * - password: a new password
   * - name: the user's full name
   */

  static async signup(username, password, name) {
    try {
      const response = await axios({
        url: `${BASE_URL}/signup`,
        method: "POST",
        data: { user: { username, password, name } },
      });
  
      let { user } = response.data
  
      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories
        },
        response.data.token
      );
    } catch (e) {
      window.alert(e)
    }
    
  }

  /** Login in user with API, make User instance & return it.

   * - username: an existing user's username
   * - password: an existing user's password
   */

  static async login(username, password) {
    const response = await axios({
      url: `${BASE_URL}/login`,
      method: "POST",
      data: { user: { username, password } },
    });

    let { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** When we already have credentials (token & username) for a user,
   *   we can log them in automatically. This function does that.
   */

  static async loginViaStoredCredentials(token, username) {
    try {
      const response = await axios({
        url: `${BASE_URL}/users/${username}`,
        method: "GET",
        params: { token },
      });

      let { user } = response.data;

      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories
        },
        token
      );
    } catch (err) {
      console.error("loginViaStoredCredentials failed", err);
      return null;
    }
  }
  async toggleFavorite(storyId){
    //if story is already in favorites, unfavorite it
    if(this.favorites.find(s => s.storyId === storyId)){
      try {
        const res = await axios.delete(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, {data: {token: this.loginToken}});
        if(res.status === 200){
          location.reload()
        }
      } catch (error) {
        console.error(error);      
        window.alert("Error unfavoriting story")
      }
    }
    //otherwise, favorite it
    else{
      try {
        const res = await axios.post(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, {token: this.loginToken});
        if(res.status === 200){
          const story = await axios.get(`${BASE_URL}/stories/${storyId}`);
          if(story.status){
            //trigger refresh
            location.reload()
          }
        }
      } catch (error) {
        console.error(error);      
        window.alert("Error favoriting story")
      }
    }
  }
  async deleteStory(storyId){
    try {
      const res = await axios.delete(`${BASE_URL}/stories/${storyId}`, {data: {token: this.loginToken}});
      if(res.status === 200){
        location.reload()
      }
    } catch (error) {
      console.error(error);      
      window.alert("Error deleting Story")
    }
  }
}
