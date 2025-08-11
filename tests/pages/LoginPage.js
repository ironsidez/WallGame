const { BasePage } = require('./BasePage');

class LoginPage extends BasePage {
  constructor(page, testContext) {
    super(page, testContext);
    this.url = 'http://localhost:3000/login';
    
    this.selectors = {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      loginButton: 'button[type="submit"]',
      registerButton: 'button:has-text("Register")',
      form: 'form'
    };
  }

  async navigate(stepName = 'navigate-to-login') {
    return await this.executeAction(stepName, 'login', async () => {
      console.log('🔐 NAVIGATING TO LOGIN PAGE');
      console.log(`🔗 Target URL: ${this.url}`);
      
      // Navigate to the URL
      await this.goto(this.url);
      
      // Log current state after navigation
      const currentState = await this.getPageState();
      console.log(`📍 After navigation - URL: ${currentState.url}`);
      console.log(`📍 After navigation - Title: ${currentState.title}`);
      
      return { navigated: true, url: this.url };
    }, { skipPreValidation: true }); // Skip pre-validation for navigation
  }

  async verifyOnLogin(stepName = 'verify-on-login') {
    return await this.executeAction(stepName, 'login', async () => {
      await this.validateExpectedPage('login');
      console.log('✅ Confirmed on login page');
      return { onLogin: true, url: this.page.url() };
    });
  }

  async fillCredentials(username, password, stepName = 'fill-credentials') {
    return await this.executeAction(stepName, 'login', async () => {
      console.log(`🔐 FILLING LOGIN CREDENTIALS (${username})`);
      
      await this.page.fill(this.selectors.usernameInput, username);
      await this.page.fill(this.selectors.passwordInput, password);
      
      console.log(`✅ Credentials filled for: ${username}`);
      return { credentialsFilled: true, username };
    });
  }

  // Use environment variables for test credentials
  async fillTestCredentials(stepName = 'fill-credentials') {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    return this.fillCredentials(username, password, stepName);
  }

  async submitLogin(stepName = 'submit-login') {
    return await this.executeAction(stepName, 'login', async () => {
      console.log('🔐 SUBMITTING LOGIN FORM');
      
      await this.page.click(this.selectors.loginButton);
      
      return { submitted: true };
    });
  }

}

module.exports = { LoginPage };
